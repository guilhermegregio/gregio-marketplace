#!/usr/bin/env node
/**
 * Materializa as rules deste package em `<repo>/.claude/rules/`.
 *
 * MVP proposital: cópia idempotente, sem estado externo. Cada arquivo copiado leva
 * um cabeçalho com origem+versão, então re-rodar atualiza e `git diff` mostra o que
 * mudou. Nada é removido sem `--prune`.
 *
 * Uso:
 *   node install-rules.mjs <repo> [--stack next,astro,...] [--dry-run] [--prune]
 *   node install-rules.mjs <repo>            # auto-detecta os stacks do repo
 *   node install-rules.mjs --list            # mostra as rules disponíveis
 *
 * A auto-detecção é por evidência no repo (package.json, arquivos), não por
 * configuração — um repo que passa a usar n8n ganha a rule na próxima execução.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(here, "../rules");
const MARKER = "gregio-cc-rules";

/** Frontmatter mínimo: `rule`, `stacks`, `version`. Sem dependência de parser YAML. */
function readRuleMeta(file) {
  const raw = readFileSync(join(rulesDir, file), "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta = { rule: file.replace(/\.md$/, ""), stacks: ["all"], version: 1 };
  if (fm) {
    const stacks = fm[1].match(/^stacks:\s*\[(.*)\]/m);
    const version = fm[1].match(/^version:\s*(\d+)/m);
    if (stacks) meta.stacks = stacks[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (version) meta.version = Number(version[1]);
  }
  return { ...meta, file, raw };
}

const RULES = readdirSync(rulesDir).filter((f) => f.endsWith(".md")).map(readRuleMeta);

if (process.argv.includes("--list")) {
  for (const r of RULES) console.log(`${r.rule.padEnd(18)} stacks: ${r.stacks.join(", ")}  v${r.version}`);
  process.exit(0);
}

const args = process.argv.slice(2);
const repo = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const dryRun = args.includes("--dry-run");
const prune = args.includes("--prune");
const stackArg = args.find((a) => a.startsWith("--stack"));
const explicitStacks = stackArg
  ? (stackArg.includes("=") ? stackArg.split("=")[1] : args[args.indexOf(stackArg) + 1] ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean)
  : null;

if (!existsSync(repo)) {
  console.error(`✗ repo não encontrado: ${repo}`);
  process.exit(1);
}

/** Evidências no repo → stacks. Barato e sem falso positivo relevante. */
function detectStacks(root) {
  const found = new Set();
  const pkgPath = join(root, "package.json");
  const pkg = existsSync(pkgPath) ? readFileSync(pkgPath, "utf8") : "";
  const deps = pkg + readTopLevelPackageJsons(root);
  if (/"next"\s*:/.test(deps)) found.add("next");
  if (/"astro"\s*:/.test(deps)) found.add("astro");
  if (existsSync(join(root, "supabase", "migrations"))) found.add("sql");
  if (existsSync(join(root, "apps", "n8n-workflows")) || existsSync(join(root, "workflows"))) {
    found.add("n8n");
  }
  return [...found];
}

/** Monorepo: as deps que importam costumam estar nos apps, não na raiz. */
function readTopLevelPackageJsons(root) {
  let out = "";
  for (const dir of ["apps", "packages"]) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const p = join(base, entry.name, "package.json");
      if (existsSync(p)) out += readFileSync(p, "utf8");
    }
  }
  return out;
}

const stacks = explicitStacks ?? detectStacks(repo);
const selected = RULES.filter(
  (r) => r.stacks.includes("all") || r.stacks.some((s) => stacks.includes(s)),
);

const target = join(repo, ".claude", "rules");
console.log(`repo:   ${repo}`);
console.log(`stacks: ${stacks.length ? stacks.join(", ") : "(nenhum detectado)"}`);
console.log(`rules:  ${selected.map((r) => r.rule).join(", ") || "(nenhuma)"}`);

if (dryRun) {
  console.log("\n(dry-run — nada escrito)");
  process.exit(0);
}

mkdirSync(target, { recursive: true });

let written = 0;
for (const rule of selected) {
  const header =
    `<!-- ${MARKER}: ${rule.rule} v${rule.version} — NÃO editar aqui.\n` +
    `     Fonte: gregio-marketplace/packages/gregio-cc-rules/rules/${rule.file}\n` +
    `     Atualize rodando install-rules.mjs de novo. -->\n\n`;
  const out = header + rule.raw;
  const dest = join(target, rule.file);
  if (existsSync(dest) && readFileSync(dest, "utf8") === out) continue;
  writeFileSync(dest, out);
  written += 1;
}

if (prune) {
  const keep = new Set(selected.map((r) => r.file));
  for (const file of readdirSync(target)) {
    if (keep.has(file)) continue;
    const content = readFileSync(join(target, file), "utf8");
    // Só remove o que este script escreveu — rule própria do repo fica.
    if (content.includes(MARKER)) rmSync(join(target, file));
  }
}

console.log(`\n✓ ${written} arquivo(s) atualizado(s) em ${target}`);
console.log("  Referencie no CLAUDE.md do repo para o agente carregar sob demanda.");
