#!/usr/bin/env node
import { parseArgs } from '../src/kb/args.js';

const COMMANDS = {
  add: () => import('../src/kb/commands/add.js'),
  capture: () => import('../src/kb/commands/capture.js'),
  new: () => import('../src/kb/commands/new.js'),
  graph: () => import('../src/kb/commands/graph.js'),
  vault: () => import('../src/kb/commands/vault.js'),
  aggregator: () => import('../src/kb/commands/vault.js'), // aggregator vive em vault.js
  project: () => import('../src/kb/commands/project.js'),
  group: () => import('../src/kb/commands/group.js'),
  dev: () => import('../src/kb/commands/dev/index.js'),
  source: () => import('../src/kb/commands/source.js'),
};

const HELP = `kb — engine da base de conhecimento

Uso: kb <comando> [args]

Comandos:
  add <url> --vault <n> [--as <cat>] [--topic t] [--projects a,b] [--tags x,y] [--smart] [--no-update]
                              ingere uma URL roteada para a subpasta certa do vault
  capture "<texto>" --vault <n> [--tags ...]
                              captura rápida em 60-sources/_inbox.md
  new --vault <n> --type <t> --title "..."   cria nota a partir de template
  vault new <n> [--visibility v]             cria e registra um vault novo
  vault list                                 lista vaults/projetos/grupos
  vault register <n> --path <p> [--visibility v]
  vault unregister <n>
  vault sync [--check|--apply]               sincroniza o scaffold 00-meta dos vaults
  aggregator build|refresh [--mode symlink|submodule]
                              (re)monta o vault agregador (visão única no Obsidian)
  project add <path> [--name n] [--group g] [--no-scan] [--subproject <subpath>...]
  project list | remove <n> | scan <n>
  group new <n> [--title t] | add <g> <membro...> | rm <g> <membro> | list
  graph build [--group g] [--force] | merge | serve
  dev start <slug> --vault <n> --project <repo> [--title t] [--ui] [--no-contract]
                                   cria um plano (draft) com as tasks-gate do devflow
  dev check <slug> [--task Txx]    valida DAG + ready-set + drift de contrato
  dev freeze <slug>                congela os contracts do plano (behaviors.feature)
  dev unfreeze <slug> --reason ""  descongela (exige justificativa; registra no plano)
  dev frozen [--slug s]            lista contratos congelados e o que saiu do lugar
  dev done <slug> [--promote ...]  promove durável + arquiva o plano + re-merge central
  dev run <slug> [--max N] [--dry-run]   orquestra as tasks (ver plan-structure)
  source discord|gmail ...    (fase posterior)
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(HELP);
    return;
  }
  const loader = COMMANDS[cmd];
  if (!loader) {
    console.error(`comando desconhecido: ${cmd}\n`);
    process.stdout.write(HELP);
    process.exit(1);
  }
  const mod = await loader();
  const args = parseArgs(rest);
  // aggregator é um alias: injeta o subcomando "aggregator" + ação.
  if (cmd === 'aggregator') {
    args.positionals.unshift('aggregator');
  }
  await mod.run(args);
}

main().catch(err => {
  console.error(`erro: ${err.message}`);
  process.exit(1);
});
