import { existsSync } from 'node:fs';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { getProject } from './config.js';
import { expandPath } from './paths.js';

// Resolução das entradas `contracts:` do _plan.md.
//
// O contrato mora na CASA DO PROJETO NO VAULT do plano, em markdown com blocos gherkin:
//   <vault>/10-projects/<projeto>/behaviors/<escopo>.feature.md
// e a entrada relativa é escrita a partir de 10-projects/ (`agentic-os/behaviors/kb-cli.feature.md`).
// Motivo: contrato é conhecimento, não runtime — no vault ele tem um path único (não se
// duplica por worktree), herda a visibilidade do vault e é indexado pelo grafo como `.md`.
//
// | entrada                                   | resolve para                                  |
// |-------------------------------------------|-----------------------------------------------|
// | absoluta ou `~/…`                         | como está                                     |
// | relativa                                  | <vault>/10-projects/<entrada>                 |
// | sem extensão                              | <entrada>.feature.md; senão <entrada>.feature (legado + aviso) |
// | com extensão explícita                    | literal                                       |
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
 * Variantes em ordem de preferência para um path: extensão explícita é literal; sem
 * extensão, `.feature.md` (formato atual) antes de `.feature` (legado).
 */
export function contractVariants(path) {
  return extname(path) ? [path] : [`${path}.feature.md`, `${path}.feature`];
}

/** Primeira variante que existe no disco; se nenhuma, a preferida (para mensagens/índice). */
function pick(variants) {
  return variants.find(p => existsSync(p)) ?? variants[0];
}

/**
 * Paths candidatos de uma entrada. Olha o disco só para escolher entre as variantes
 * de uma entrada sem extensão (`.feature.md` → `.feature`).
 * `{ absolute }` para entrada absoluta/~; senão `{ vault, repos: [{project, path}] }`.
 * `absoluteTried` / `vaultTried` / `repos[].tried` listam todas as variantes.
 */
export function contractCandidates({ config, vault, plan, entry }) {
  if (isAbsolute(entry) || entry === '~' || entry.startsWith('~/')) {
    const tried = contractVariants(expandPath(entry));
    return { absolute: pick(tried), absoluteTried: tried };
  }
  const repos = [];
  for (const name of plan?.frontmatter?.projects ?? []) {
    const proj = getProject(config, name);
    if (!proj) continue;
    const tried = contractVariants(resolve(expandPath(proj.path), entry));
    repos.push({ project: name, path: pick(tried), tried });
  }
  const vaultTried = contractVariants(join(projectsRoot(vault), entry));
  return { vault: pick(vaultTried), vaultTried, repos };
}

/** Aviso de `.feature` puro resolvido a partir de entrada sem extensão. */
function warnLegacyFormat(entry, file) {
  process.stderr.write(
    `⚠️  contrato em .feature puro é legado: ${file}\n` +
    `   converta para ${file}.md (markdown com frontmatter \`type: contract\`, uma seção ` +
    '"## Funcionalidade: ..." por funcionalidade e os cenários em bloco ```gherkin) ' +
    `e aponte \`contracts:\` para ${entry}.feature.md\n`,
  );
}

/**
 * Resolve uma entrada de `contracts:` para o path absoluto do arquivo.
 * Devolve `{ file, legacy, project? }`; emite os avisos de legado no stderr (a menos
 * que `quiet`). Lança se o arquivo não existe em nenhum dos candidatos.
 */
export function resolveContract({ config, vault, plan, entry, quiet = false }) {
  const c = contractCandidates({ config, vault, plan, entry });
  const legacyFormat = file => {
    if (!quiet && !extname(entry) && file.endsWith('.feature')) warnLegacyFormat(entry, file);
  };
  if (c.absolute) {
    if (!existsSync(c.absolute)) throw new Error(`contrato não existe: ${c.absoluteTried.join(' | ')}`);
    legacyFormat(c.absolute);
    return { file: c.absolute, legacy: false };
  }
  if (existsSync(c.vault)) {
    legacyFormat(c.vault);
    return { file: c.vault, legacy: false };
  }

  const hit = c.repos.find(r => existsSync(r.path));
  if (hit) {
    if (!quiet) {
      process.stderr.write(
        `⚠️  contrato no repo é legado: ${hit.path}\n` +
        `   mova para ${behaviorsDir(vault, hit.project)}/ e aponte \`contracts:\` para ` +
        `${hit.project}/behaviors/<escopo>.feature.md\n`,
      );
    }
    legacyFormat(hit.path);
    return { file: hit.path, legacy: true, project: hit.project };
  }

  const tried = c.vaultTried.map(p => `  vault: ${p}`);
  if (c.repos.length) for (const r of c.repos) for (const p of r.tried) tried.push(`  repo:  ${p}  (${r.project})`);
  else tried.push('  repo:  (nenhum projeto de `projects:` registrado no kb)');
  throw new Error(`contrato "${entry}" não encontrado. Paths tentados:\n${tried.join('\n')}`);
}
