/**
 * Estado de trabalho não salvo nos repos do harness.
 *
 * Base: `~/code/check-uncommitted.sh` (working tree sujo + ahead/behind). Aqui o
 * escopo cresce para o que o fluxo com worktree cria de risco real:
 *
 *  - **branch de feature não mergeada** — `wtree --rm -f` apaga a branch sem
 *    perguntar; já foi preciso recuperar commit por `git fsck`;
 *  - **worktree ativo** — trabalho aberto que ninguém lembra que existe;
 *  - **diretório órfão em ~/code/worktrees** — sobra de worktree removido (o
 *    `git worktree` não conhece mais, mas os arquivos ficam ocupando disco e
 *    confundindo buscas);
 *  - **stash** — o esconderijo que todo mundo esquece.
 *
 * Puro: descobre e classifica; quem imprime é o CLI.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function git(repo, args) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return r.status === 0 && !r.error ? (r.stdout ?? "").trim() : null;
}

/** Repos git em `dir` (1 nível — monorepo é um repo só, não varremos dentro). */
export function findRepos(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, ".git")))
    .map((e) => resolve(join(dir, e.name)))
    .sort();
}

/**
 * Diretórios em `~/code/worktrees` sem `.git` — o `git worktree remove` levou o
 * registro, mas alguém interrompeu antes de apagar os arquivos (ou o `-f` falhou
 * no meio). Não são recuperáveis por git: ou têm lixo, ou trabalho perdido.
 */
export function findOrphanWorktreeDirs(worktreesDir) {
  if (!existsSync(worktreesDir)) return [];
  return readdirSync(worktreesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !existsSync(join(worktreesDir, e.name, ".git")))
    .map((e) => resolve(join(worktreesDir, e.name)))
    .sort();
}

/** Branches locais com commits que não estão na branch principal do repo. */
function unmergedBranches(repo) {
  const head = git(repo, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const main = ["main", "master"].find((b) => git(repo, ["rev-parse", "--verify", "--quiet", b]));
  if (!main) return [];
  const merged = new Set(
    (git(repo, ["branch", "--format=%(refname:short)", "--merged", main]) ?? "")
      .split("\n").map((s) => s.trim()).filter(Boolean),
  );
  return (git(repo, ["branch", "--format=%(refname:short)"]) ?? "")
    .split("\n").map((s) => s.trim())
    .filter((b) => b && b !== main && !merged.has(b))
    .map((b) => ({
      name: b,
      current: b === head,
      commits: Number(git(repo, ["rev-list", "--count", `${main}..${b}`]) ?? 0),
    }));
}

/** Worktrees vinculados (exclui o checkout principal). */
function linkedWorktrees(repo) {
  const out = git(repo, ["worktree", "list", "--porcelain"]) ?? "";
  const list = [];
  let current = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length), branch: null };
      list.push(current);
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  return list.slice(1); // o primeiro é o checkout principal
}

/**
 * Estado de um repo. `findings` vazio = limpo.
 * Cada finding tem `level`: `warn` (perde trabalho se ignorar) ou `info`.
 */
export function repoStatus(repo) {
  const findings = [];

  const porcelain = git(repo, ["status", "--porcelain"]);
  if (porcelain === null) return { repo, error: "não é um repo git legível", findings };
  if (porcelain) {
    const files = porcelain.split("\n").filter(Boolean);
    const staged = files.filter((l) => l[0] !== " " && l[0] !== "?").length;
    findings.push({
      level: "warn",
      what: "mudanças não commitadas",
      detail: `${files.length} arquivo(s)${staged ? `, ${staged} staged` : ""}`,
    });
  }

  // ahead/behind do upstream (só quando há upstream configurado)
  const tracking = git(repo, ["status", "-sb", "--porcelain=v1"])?.split("\n")[0] ?? "";
  const ahead = tracking.match(/ahead (\d+)/)?.[1];
  const behind = tracking.match(/behind (\d+)/)?.[1];
  if (ahead || behind) {
    findings.push({
      level: ahead ? "warn" : "info",
      what: ahead && behind ? "divergiu do remoto" : ahead ? "commits não enviados" : "commits não baixados",
      detail: [ahead && `${ahead} ahead`, behind && `${behind} behind`].filter(Boolean).join(", "),
    });
  }

  const stash = Number(git(repo, ["stash", "list"])?.split("\n").filter(Boolean).length ?? 0);
  if (stash) findings.push({ level: "warn", what: "stash pendente", detail: `${stash} entrada(s)` });

  for (const b of unmergedBranches(repo)) {
    findings.push({
      level: "warn",
      what: "branch não mergeada",
      detail: `${b.name} (${b.commits} commit(s)${b.current ? ", atual" : ""})`,
    });
  }

  for (const wt of linkedWorktrees(repo)) {
    findings.push({
      level: "info",
      what: "worktree ativo",
      detail: `${basename(wt.path)}${wt.branch ? ` [${wt.branch}]` : ""}`,
    });
  }

  return { repo, error: null, findings };
}

export function hasWarnings(status) {
  return status.findings.some((f) => f.level === "warn") || Boolean(status.error);
}
