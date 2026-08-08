#!/usr/bin/env node
/**
 * CLI de bootstrap do harness (plano harness-vnext, T06).
 *
 * Subcomandos:
 *   doctor            valida o conjunto e imprime relatório ✓/✗ (exit 1 se houver ✗)
 *   status            trabalho não salvo nos repos (uncommitted, unpushed, branch
 *                     não mergeada, worktree ativo, stash) — exit 1 se houver risco
 *   map               cruza ~/code com os projects do kb e lista os não registrados
 *   install <repo>    materializa rules (delega ao gregio-cc-rules) + hook guard.mjs
 *                     no settings.json global. Aceita --dry-run.
 *
 * Zero dependências, Node ESM >= 20. Cada check do doctor nasceu de uma dor real
 * (ver CLAUDE.md do package) — não remova checks sem registrar o porquê.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  findOrphanWorktreeDirs,
  findRepos,
  hasWarnings,
  repoStatus,
} from "./lib/repo-status.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const home = homedir();

const kbConfigPath = join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "kb", "config.json");
const settingsPath = join(home, ".claude", "settings.json");
const installedPluginsPath = join(home, ".claude", "plugins", "installed_plugins.json");

// Host de PROD do n8n — credencial dev apontando pra cá já queimou dados reais.
const N8N_PROD_HOST = "auth.nxttrainingapp.com";
const GUARD_HOOK_COMMAND = "node ~/code/knowledge-gregio/hooks/guard.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0 && !r.error, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(), error: r.error };
}

/** O hook do guard pode mudar de matcher; o que identifica é o "guard.mjs" no command. */
function hasGuardHook(settings) {
  const groups = settings?.hooks?.PreToolUse ?? [];
  return groups.some((g) => (g.hooks ?? []).some((h) => (h.command ?? "").includes("guard.mjs")));
}

// ─── doctor ──────────────────────────────────────────────────────────────────

function doctor() {
  const results = [];
  const check = (ok, label, detail) => {
    results.push(ok);
    console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  };
  const skip = (label, detail) => console.log(`- ${label} — ${detail}`);

  // 1. kb config (respeita XDG_CONFIG_HOME)
  let kbConfig = null;
  try {
    kbConfig = readJson(kbConfigPath);
    check(true, "kb config", kbConfigPath);
  } catch (e) {
    check(false, "kb config", `${kbConfigPath}: ${e.code === "ENOENT" ? "não existe" : e.message}`);
  }

  // 2. plugins instalados (scope user) precisam estar em enabledPlugins e habilitados.
  //    Plugin instalado mas desabilitado passa despercebido por semanas — dor real.
  let settings = null;
  try {
    settings = readJson(settingsPath);
  } catch (e) {
    check(false, "settings.json", `${settingsPath}: ${e.message}`);
  }
  try {
    const installed = readJson(installedPluginsPath).plugins ?? {};
    const enabled = settings?.enabledPlugins ?? {};
    const userScoped = Object.entries(installed).filter(([, entries]) =>
      entries.some((e) => e.scope === "user"),
    );
    for (const [key] of userScoped) {
      if (enabled[key] === true) {
        check(true, `plugin ${key}`, "habilitado");
      } else {
        check(false, `plugin ${key}`, enabled[key] === false ? "instalado mas DESABILITADO em enabledPlugins" : "instalado mas ausente de enabledPlugins");
      }
    }
    if (userScoped.length === 0) skip("plugins", "nenhum plugin com scope user instalado");
  } catch (e) {
    check(false, "plugins instalados", `${installedPluginsPath}: ${e.message}`);
  }

  // 3. hook guard.mjs (guardrail de freeze/wtree) em hooks.PreToolUse
  if (settings) {
    check(hasGuardHook(settings), "hook guard.mjs em PreToolUse", hasGuardHook(settings) ? undefined : "guardrail de freeze/wtree ausente — rode: harness install <repo>");
  }

  // 4. graphify: presente e sem warning de skill desatualizada
  const g = run("graphify", ["--version"]);
  if (g.error || !g.ok) {
    check(false, "graphify", g.error ? "não encontrado no PATH" : g.out);
  } else {
    const warning = g.out.split("\n").find((l) => /desatualizad|outdated/i.test(l));
    check(!warning, "graphify", warning ? `warning: ${warning.trim()}` : g.out);
  }

  // 5. n8n dev: workflow importado apontando pro auth de PROD (credencial dev → prod, dor real)
  const ps = run("docker", ["ps", "--format", "{{.Names}}"]);
  if (ps.error || !ps.ok) {
    skip("n8n dev → prod", "docker indisponível");
  } else if (!ps.out.split("\n").includes("n8n-dev")) {
    skip("n8n dev → prod", "container n8n-dev não está rodando");
  } else {
    const query = `psql -U $POSTGRES_USER -d n8n_dev -t -A -c "select count(*) from workflow_entity where nodes::text like '%${N8N_PROD_HOST}%'"`;
    const q = run("docker", ["exec", "postgres-dev", "sh", "-c", query]);
    if (!q.ok) {
      check(false, "n8n dev → prod", `query falhou: ${q.out || q.error?.message}`);
    } else {
      const count = Number(q.out);
      check(count === 0, "n8n dev → prod", count === 0 ? `nenhum workflow aponta para ${N8N_PROD_HOST}` : `${count} workflow(s) apontam para ${N8N_PROD_HOST} — credencial dev usando prod!`);
    }
  }

  const failures = results.filter((ok) => !ok).length;
  console.log(failures ? `\n✗ ${failures} problema(s) encontrado(s)` : "\n✓ tudo certo");
  process.exit(failures ? 1 : 0);
}

// ─── map ─────────────────────────────────────────────────────────────────────

function map() {
  const codeDir = join(home, "code");
  const repos = readdirSync(codeDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(codeDir, e.name, ".git")))
    .map((e) => join(codeDir, e.name));

  // Registrado = project OU vault do kb (vault é repo git, mas não é "project").
  let registered = new Set();
  try {
    const cfg = readJson(kbConfigPath);
    registered = new Set([
      ...(cfg.projects ?? []).map((p) => resolve(p.path)),
      ...(cfg.vaults ?? []).map((v) => resolve(v.path)),
    ]);
  } catch {
    console.error(`✗ kb config não encontrado em ${kbConfigPath} — tudo aparecerá como não registrado`);
  }

  const missing = repos.filter((r) => !registered.has(r));
  console.log(`repos git em ${codeDir}: ${repos.length} (${repos.length - missing.length} registrados no kb)`);
  if (!missing.length) {
    console.log("✓ todos registrados");
    return;
  }
  console.log("\nnão registrados:");
  for (const r of missing) console.log(`  ${r}\n    → kb project add ${r}`);
}

// ─── status ──────────────────────────────────────────────────────────────────

/**
 * Onde há trabalho não salvo. Nasceu de `~/code/check-uncommitted.sh` e cresceu
 * para os riscos que o fluxo com worktree cria: branch não mergeada (o
 * `wtree --rm -f` apaga sem perguntar) e sobras em `~/code/worktrees`.
 */
function status(baseDirArg, { all = false } = {}) {
  const baseDir = resolve(baseDirArg ?? join(home, "code"));
  const repos = findRepos(baseDir);
  if (!repos.length) {
    console.log(`nenhum repo git em ${baseDir}`);
    return;
  }

  let risky = 0;
  for (const repo of repos) {
    const st = repoStatus(repo);
    const warn = hasWarnings(st);
    if (warn) risky += 1;
    if (!warn && !all) continue;

    const name = basename(repo);
    console.log(`${warn ? "⚠️ " : "✓ "} ${name}`);
    if (st.error) console.log(`     ✗ ${st.error}`);
    for (const f of st.findings) {
      console.log(`     ${f.level === "warn" ? "•" : "·"} ${f.what}: ${f.detail}`);
    }
  }

  // Sobras de worktree: o git não as conhece mais, então nenhum repo as reporta.
  const orphans = findOrphanWorktreeDirs(join(baseDir, "worktrees"));
  if (orphans.length) {
    console.log(`\n⚠️  ${orphans.length} diretório(s) órfão(s) em ${join(baseDir, "worktrees")}:`);
    for (const o of orphans) console.log(`     ${basename(o)}  → confira e apague: rm -rf ${o}`);
    risky += orphans.length;
  }

  console.log(
    risky
      ? `\n${risky} item(ns) com trabalho não salvo — commit, push, merge ou descarte antes de trocar de contexto.`
      : `\n✓ ${repos.length} repo(s) limpos.`,
  );
  if (risky) process.exitCode = 1;
}

// ─── install ─────────────────────────────────────────────────────────────────

/** Delegação, nunca duplicação: as rules moram no gregio-cc-rules. */
function findInstallRules() {
  const candidates = [
    // checkout do repo / worktree: packages são irmãos
    resolve(here, "../../gregio-cc-rules/scripts/install-rules.mjs"),
    // instalação via /plugin com marketplace clonado em repos/
    join(home, ".claude", "plugins", "repos", "gregio-marketplace", "packages", "gregio-cc-rules", "scripts", "install-rules.mjs"),
  ];
  // marketplace registrado por path local (known_marketplaces.json)
  try {
    const known = readJson(join(home, ".claude", "plugins", "known_marketplaces.json"));
    const src = known["gregio-marketplace"]?.source?.path ?? known["gregio-marketplace"]?.path;
    if (src) candidates.push(join(src, "packages", "gregio-cc-rules", "scripts", "install-rules.mjs"));
  } catch {
    // sem known_marketplaces — os outros candidatos cobrem
  }
  return candidates.find(existsSync);
}

function install(repoArg, dryRun) {
  if (!repoArg) {
    console.error("uso: harness.mjs install <repo> [--dry-run]");
    process.exit(1);
  }
  const repo = resolve(repoArg);
  if (!existsSync(repo)) {
    console.error(`✗ repo não encontrado: ${repo}`);
    process.exit(1);
  }

  // 1. rules — delega ao gregio-cc-rules
  const installRules = findInstallRules();
  if (!installRules) {
    console.error("✗ install-rules.mjs não encontrado (gregio-cc-rules não está junto deste package)");
    process.exit(1);
  }
  console.log(`rules via ${installRules}\n`);
  const r = spawnSync(process.execPath, [installRules, repo, ...(dryRun ? ["--dry-run"] : [])], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);

  // 2. hook guard.mjs no settings.json global (idempotente, backup antes de escrever)
  let settings = {};
  try {
    settings = readJson(settingsPath);
  } catch (e) {
    if (e.code !== "ENOENT") {
      // settings corrompido: parar em vez de sobrescrever a config do usuário
      console.error(`✗ ${settingsPath} ilegível: ${e.message}`);
      process.exit(1);
    }
  }
  if (hasGuardHook(settings)) {
    console.log("\n✓ hook guard.mjs já presente em hooks.PreToolUse");
    return;
  }
  const entry = {
    matcher: "Edit|Write|NotebookEdit",
    hooks: [{ type: "command", command: GUARD_HOOK_COMMAND }],
  };
  if (dryRun) {
    console.log(`\n(dry-run) adicionaria a hooks.PreToolUse de ${settingsPath}:`);
    console.log(JSON.stringify(entry, null, 2));
    return;
  }
  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  settings.hooks.PreToolUse.push(entry);
  if (existsSync(settingsPath)) copyFileSync(settingsPath, `${settingsPath}.bak`);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`\n✓ hook guard.mjs adicionado a ${settingsPath} (backup em settings.json.bak)`);
}

// ─── entrypoint ──────────────────────────────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const dryRun = rest.includes("--dry-run");
const positional = rest.filter((a) => !a.startsWith("--"));

switch (cmd) {
  case "doctor":
    doctor();
    break;
  case "status":
    status(positional[0], { all: rest.includes("--all") });
    break;
  case "map":
    map();
    break;
  case "install":
    install(positional[0], dryRun);
    break;
  default:
    console.log("uso: harness.mjs <doctor|status [dir] [--all]|map|install <repo> [--dry-run]>");
    process.exit(cmd ? 1 : 0);
}
