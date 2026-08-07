#!/usr/bin/env node
/**
 * Hook PreToolUse do Claude Code — os dois guardrails do harness.
 *
 * 1. 🧊 **Contrato congelado** (devflow v2): editar um `behaviors.feature` que está sob
 *    freeze é BLOQUEADO. O contrato é escrito e aprovado antes do código; cenário
 *    quebrando significa código errado, não cenário otimista. Liberar exige
 *    `kb dev unfreeze <plano> --reason "..."` — decisão de produto, com rastro.
 *
 * 2. 🌳 **Feature na main**: escrever em repo registrado no kb estando na `main`
 *    gera AVISO (não bloqueio — hotfix, doc e ajuste pontual existem). A regra é
 *    `wtree <branch>` para feature.
 *
 * Contrato do hook: lê o payload JSON no stdin, responde JSON no stdout.
 * `deny` bloqueia a chamada; `ask`/ausência de decisão deixa o fluxo seguir. Qualquer
 * exceção aqui é engolida — um guardrail quebrado não pode travar o trabalho.
 *
 * Instalação: ver `hooks/README.md`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const STATE = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
const CONFIG = process.env.KB_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'kb', 'config.json');
const FREEZE_INDEX = join(STATE, 'kb', 'frozen-contracts.json');

function readJson(path, fallback) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function allow() {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse' } }));
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

/** Aviso não-bloqueante: o texto chega ao modelo como contexto adicional. */
function warn(context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context },
  }));
  process.exit(0);
}

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  allow();
}

const filePath = payload?.tool_input?.file_path;
if (!filePath) allow();
const target = resolve(filePath);

// ---------------------------------------------------------------- 1. freeze ----
/**
 * Identidade do arquivo dentro do repo: `<raiz-real>::<caminho-relativo>`.
 *
 * O contrato é congelado no path do repo principal, mas o código é escrito em
 * WORKTREE — outro path para o mesmo arquivo versionado. Sem normalizar, o
 * guardrail protegeria exatamente onde ninguém edita e liberaria onde todo mundo
 * edita. `--git-common-dir` aponta para o `.git` do repo principal mesmo a partir
 * de um worktree, então worktree e repo colapsam na mesma identidade.
 */
function repoIdentity(absPath) {
  try {
    const common = execFileSync('git', ['-C', dirname(absPath), 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const root = dirname(common);
    const top = execFileSync('git', ['-C', dirname(absPath), 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `${root}::${absPath.slice(top.length + 1)}`;
  } catch {
    return null;
  }
}

const index = readJson(FREEZE_INDEX, { entries: [] });
const targetIdentity = repoIdentity(target);
const frozen = (index.entries ?? []).find(e => {
  if (resolve(e.file) === target) return true;
  if (!targetIdentity) return false;
  return repoIdentity(resolve(e.file)) === targetIdentity;
});
if (frozen) {
  deny(
    `🧊 CONTRATO CONGELADO — ${frozen.file}\n\n` +
    `Este behaviors.feature foi aprovado e congelado no plano "${frozen.plan}" ` +
    `(${frozen.frozen_at?.slice(0, 10) ?? '?'}), ANTES da implementação.\n\n` +
    `Se um cenário está falhando, o padrão é: **o código está errado**. Corrija o código.\n\n` +
    `Se o comportamento REALMENTE precisa mudar, isso é decisão de produto — peça ao ` +
    `usuário e registre:\n` +
    `  kb dev unfreeze ${frozen.plan} --file "${frozen.file}" --reason "<por quê>"\n` +
    `Depois de ajustar o contrato, recongele com \`kb dev freeze ${frozen.plan}\`.`,
  );
}

// ------------------------------------------------------------------ 2. wtree ----
const config = readJson(CONFIG, {});
const projects = config.projects ?? [];
const expand = p => (p?.startsWith('~') ? join(homedir(), p.slice(1)) : p);

const project = projects
  .map(p => ({ ...p, abs: resolve(expand(p.path)) }))
  .filter(p => target === p.abs || target.startsWith(`${p.abs}/`))
  // repo mais específico vence (monorepo aninhado)
  .sort((a, b) => b.abs.length - a.abs.length)[0];

if (!project) allow();

// Worktree de feature tem `.git` como arquivo (gitdir: ...), não diretório — mas o
// que decide é a branch, então pergunte ao git.
let branch = '';
try {
  branch = execFileSync('git', ['-C', dirname(target), 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  allow();
}

if (branch !== 'main' && branch !== 'master') allow();

// Só incomoda quando há trabalho de plano em curso: alguém mexendo em doc ou
// hotfix na main não deve levar sermão.
const activePlans = [];
for (const vault of config.vaults ?? []) {
  const plansDir = join(resolve(expand(vault.path)), '30-plans');
  if (!existsSync(plansDir)) continue;
  let entries = [];
  try {
    entries = readdirSync(plansDir, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    const planFile = join(plansDir, e.name, '_plan.md');
    if (!existsSync(planFile)) continue;
    const head = readFileSync(planFile, 'utf8').slice(0, 800);
    if (!/^status:\s*(approved|in-progress)/m.test(head)) continue;
    if (head.includes(project.name)) activePlans.push(e.name);
  }
}

if (!activePlans.length) allow();

warn(
  `🌳 Você está escrevendo em ${project.name} na branch "${branch}" com plano ativo ` +
  `(${activePlans.join(', ')}).\n` +
  `A regra do harness é: feature vai em worktree, nunca na main.\n` +
  `  wtree <branch-da-task>   # cria worktree + workspace herdr\n` +
  `Se isto é hotfix/doc/ajuste pontual, siga — mas diga ao usuário que está na main.`,
);
