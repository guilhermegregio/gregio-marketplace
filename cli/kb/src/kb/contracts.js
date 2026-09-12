import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { getProject } from './config.js';
import { expandPath } from './paths.js';

// Resolução das entradas `contracts:` do _plan.md.
//
// O contrato mora na CASA DO PROJETO NO VAULT do plano:
//   <vault>/10-projects/<projeto>/behaviors/<escopo>.feature
// e a entrada relativa é escrita a partir de 10-projects/ (`agentic-os/behaviors/kb-cli.feature`).
// Motivo: contrato é conhecimento, não runtime — no vault ele tem um path único (não se
// duplica por worktree) e herda a visibilidade do vault.
//
// | entrada                                   | resolve para                                  |
// |-------------------------------------------|-----------------------------------------------|
// | absoluta ou `~/…`                         | como está                                     |
// | relativa                                  | <vault>/10-projects/<entrada>                 |
// | relativa ausente no vault, presente no repo | repo do projeto (legado) + aviso no stderr |
// | ausente em todo lugar                     | erro com os paths tentados                    |

/** Onde um contrato relativo ao vault mora: `<vault>/10-projects/`. */
export function projectsRoot(vault) {
  return join(expandPath(vault.path), '10-projects');
}

/** Pasta canônica de contratos de um projeto no vault. */
export function behaviorsDir(vault, project) {
  return join(projectsRoot(vault), project, 'behaviors');
}

/**
 * Paths candidatos de uma entrada, sem olhar o disco.
 * `{ absolute }` para entrada absoluta/~; senão `{ vault, repos: [{project, path}] }`.
 */
export function contractCandidates({ config, vault, plan, entry }) {
  if (isAbsolute(entry) || entry === '~' || entry.startsWith('~/')) {
    return { absolute: expandPath(entry) };
  }
  const repos = [];
  for (const name of plan?.frontmatter?.projects ?? []) {
    const proj = getProject(config, name);
    if (proj) repos.push({ project: name, path: resolve(expandPath(proj.path), entry) });
  }
  return { vault: join(projectsRoot(vault), entry), repos };
}

/**
 * Resolve uma entrada de `contracts:` para o path absoluto do arquivo.
 * Devolve `{ file, legacy, project? }`; emite o aviso de legado no stderr (a menos
 * que `quiet`). Lança se o arquivo não existe em nenhum dos candidatos.
 */
export function resolveContract({ config, vault, plan, entry, quiet = false }) {
  const c = contractCandidates({ config, vault, plan, entry });
  if (c.absolute) {
    if (!existsSync(c.absolute)) throw new Error(`contrato não existe: ${c.absolute}`);
    return { file: c.absolute, legacy: false };
  }
  if (existsSync(c.vault)) return { file: c.vault, legacy: false };

  const hit = c.repos.find(r => existsSync(r.path));
  if (hit) {
    if (!quiet) {
      process.stderr.write(
        `⚠️  contrato no repo é legado: ${hit.path}\n` +
        `   mova para ${behaviorsDir(vault, hit.project)}/ e aponte \`contracts:\` para ` +
        `${hit.project}/behaviors/<escopo>.feature\n`,
      );
    }
    return { file: hit.path, legacy: true, project: hit.project };
  }

  const tried = [`  vault: ${c.vault}`];
  if (c.repos.length) for (const r of c.repos) tried.push(`  repo:  ${r.path}  (${r.project})`);
  else tried.push('  repo:  (nenhum projeto de `projects:` registrado no kb)');
  throw new Error(`contrato "${entry}" não encontrado. Paths tentados:\n${tried.join('\n')}`);
}
