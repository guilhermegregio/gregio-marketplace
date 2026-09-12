import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONFIG_PATH, expandPath } from '../paths.js';
import { readIndex } from '../freeze.js';

// `kb guard` — hook PreToolUse do Claude Code com os dois guardrails do harness.
//
// 1. 🧊 **Contrato congelado** (devflow v2): editar um `.feature` que está sob freeze
//    é BLOQUEADO — seja na casa do projeto no vault (canônico) ou num repo (legado). O contrato é escrito e aprovado antes do código; cenário
//    quebrando significa código errado, não cenário otimista. Liberar exige
//    `kb dev unfreeze <plano> --reason "..."` — decisão de produto, com rastro.
//
// 2. 🌳 **Feature na main**: escrever em repo registrado no kb estando na `main` gera
//    AVISO (não bloqueio — hotfix, doc e ajuste pontual existem). A regra é
//    `wtree <branch>` para feature.
//
// Contrato do hook: lê o payload JSON no stdin, responde JSON no stdout. `deny` bloqueia
// a chamada; ausência de decisão deixa o fluxo seguir. Qualquer exceção aqui vira
// liberação — um guardrail quebrado não pode travar o trabalho.
//
// Instalar em ~/.claude/settings.json:
//   hooks.PreToolUse[{ matcher: "Edit|Write|NotebookEdit",
//                      hooks: [{ type: "command", command: "kb guard" }] }]

const ALLOW = { hookSpecificOutput: { hookEventName: 'PreToolUse' } };

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/** Aviso não-bloqueante: o texto chega ao modelo como contexto adicional. */
function warn(context) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context } };
}

function readJson(path, fallback) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Identidade do arquivo dentro do repo: `<raiz-real>::<caminho-relativo>`.
 *
 * Só para contratos LEGADOS (no repo): o contrato é congelado no path do repo principal,
 * mas o código é escrito em WORKTREE — outro path para o mesmo arquivo versionado. Sem normalizar, o guardrail
 * protegeria exatamente onde ninguém edita e liberaria onde todo mundo edita.
 * `--git-common-dir` aponta para o `.git` do repo principal mesmo a partir de um
 * worktree, então worktree e repo colapsam na mesma identidade.
 * Contrato na casa do projeto no vault tem path único — basta o path exato.
 */
function repoIdentity(absPath) {
  try {
    const cwd = dirname(absPath);
    const root = dirname(git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
    const top = git(cwd, ['rev-parse', '--show-toplevel']);
    return `${root}::${absPath.slice(top.length + 1)}`;
  } catch {
    return null;
  }
}

/** Contrato na casa do projeto no vault (`…/10-projects/…`) — não precisa de identidade git. */
function isVaultContract(absPath) {
  return absPath.includes('/10-projects/');
}

async function decide() {
  const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const filePath = payload?.tool_input?.file_path;
  if (!filePath) return ALLOW;
  const target = resolve(filePath);

  // ------------------------------------------------------------------ freeze ----
  const index = await readIndex();
  const entries = index.entries ?? [];
  let frozen = entries.find(e => resolve(e.file) === target);
  const legacy = entries.filter(e => !isVaultContract(resolve(e.file)));
  if (!frozen && legacy.length) {
    // identidade git é cara (2 execs por arquivo) — só para entradas legadas
    const targetIdentity = repoIdentity(target);
    if (targetIdentity) frozen = legacy.find(e => repoIdentity(resolve(e.file)) === targetIdentity);
  }
  if (frozen) {
    const where = isVaultContract(resolve(frozen.file))
      ? 'Ele mora na casa do projeto no vault (path único, sem cópia em worktree).'
      : 'Ele ainda está num repo (legado) — o lugar dele é a casa do projeto no vault ' +
        '(<vault>/10-projects/<projeto>/behaviors/).';
    const vaultFlag = frozen.vault ? ` --vault ${frozen.vault}` : '';
    return deny(
      `🧊 CONTRATO CONGELADO — ${frozen.file}\n\n` +
      `Este contrato foi aprovado e congelado no plano "${frozen.plan}" ` +
      `(${frozen.frozen_at?.slice(0, 10) ?? '?'}), ANTES da implementação. ${where}\n\n` +
      'Se um cenário está falhando, o padrão é: **o código está errado**. Corrija o código.\n\n' +
      'Se o comportamento REALMENTE precisa mudar, isso é decisão de produto — peça ao ' +
      'usuário e registre:\n' +
      `  kb dev unfreeze ${frozen.plan}${vaultFlag} --file "${frozen.file}" --reason "<por quê>"\n` +
      `Depois de ajustar o contrato, recongele com \`kb dev freeze ${frozen.plan}${vaultFlag}\`.`,
    );
  }

  // ------------------------------------------------------------------- wtree ----
  const config = readJson(CONFIG_PATH, {});
  const project = (config.projects ?? [])
    .map(p => ({ ...p, abs: expandPath(p.path) }))
    .filter(p => target === p.abs || target.startsWith(`${p.abs}/`))
    // repo mais específico vence (monorepo aninhado)
    .sort((a, b) => b.abs.length - a.abs.length)[0];
  if (!project) return ALLOW;

  // Worktree de feature tem `.git` como arquivo (gitdir: ...), não diretório — mas o
  // que decide é a branch, então pergunte ao git.
  let branch = '';
  try {
    branch = git(dirname(target), ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return ALLOW;
  }
  if (branch !== 'main' && branch !== 'master') return ALLOW;

  // Só incomoda quando há trabalho de plano em curso: alguém mexendo em doc ou hotfix
  // na main não deve levar sermão.
  const activePlans = [];
  for (const vault of config.vaults ?? []) {
    const plansDir = join(expandPath(vault.path), '30-plans');
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
  if (!activePlans.length) return ALLOW;

  return warn(
    `🌳 Você está escrevendo em ${project.name} na branch "${branch}" com plano ativo ` +
    `(${activePlans.join(', ')}).\n` +
    'A regra do harness é: feature vai em worktree, nunca na main.\n' +
    '  wtree <branch-da-task>   # cria worktree + workspace herdr\n' +
    'Se isto é hotfix/doc/ajuste pontual, siga — mas diga ao usuário que está na main.',
  );
}

export async function run() {
  let out;
  try {
    out = await decide();
  } catch {
    // Fail-permissivo: índice ausente/corrompido, stdin vazio, git indisponível,
    // config ilegível — nada disso pode travar o trabalho do usuário.
    out = ALLOW;
  }
  process.stdout.write(JSON.stringify(out));
}
