import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expandPath } from './paths.js';

// Marcadores do bloco de cross-link (idempotência: substitui o miolo entre eles).
const START = '<!-- kb:link start -->';
const END = '<!-- kb:link end -->';

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Resolve onde o conhecimento do projeto mora → { vaultName, folder }.
// Ordem: (1) override explícito no config (project.vault / project.vaultProject);
// (2) pasta já existente em <vault>/10-projects/<slug> (reflete a migração real);
// (3) fallback: vault default + slug do nome (caminho convencional, ainda inexistente).
export function resolveVaultTarget(config, project) {
  const vaults = config.vaults ?? [];
  if (!vaults.length) return null;
  const candidates = [...new Set([project.name, slug(project.name)])];
  const hasFolder = (vaultPath, folder) =>
    existsSync(join(expandPath(vaultPath), '10-projects', folder));

  if (project.vault) {
    const v = vaults.find(x => x.name === project.vault);
    if (v) {
      const folder =
        project.vaultProject ??
        candidates.find(c => hasFolder(v.path, c)) ??
        slug(project.name);
      return { vaultName: v.name, folder };
    }
  }
  for (const v of vaults) {
    const folder = candidates.find(c => hasFolder(v.path, c));
    if (folder) return { vaultName: v.name, folder };
  }
  const def = vaults.find(x => x.default) ?? vaults[0];
  return { vaultName: def.name, folder: slug(project.name) };
}

function renderBlock(target) {
  const path = `vault-${target.vaultName}/10-projects/${target.folder}/`;
  return [
    START,
    `> 📚 **Conhecimento deste projeto mora no vault:** \`${path}\``,
    '>',
    '> Repo = código + runtime. Docs, arquitetura, ADRs, planos, learnings e research',
    '> vivem no vault (não crie doc/plano solto aqui). Consulte/registre via skill `kb`;',
    '> planos cross-project via `kb dev` (skill `devflow`).',
    END,
  ].join('\n');
}

// Insere/atualiza o bloco de cross-link no CLAUDE.md do repo. Idempotente: se os
// marcadores já existem, troca só o miolo; senão anexa ao fim. Cria CLAUDE.md mínimo
// se ausente. Retorna { file, target, changed }.
export async function linkClaudeMd(repoRoot, config, project) {
  const target = resolveVaultTarget(config, project);
  if (!target) throw new Error('nenhum vault registrado para resolver destino');
  const file = join(repoRoot, 'CLAUDE.md');
  const block = renderBlock(target);
  let next;
  if (existsSync(file)) {
    const cur = await readFile(file, 'utf8');
    const re = new RegExp(`${START}[\\s\\S]*?${END}`);
    next = re.test(cur) ? cur.replace(re, block) : `${cur.replace(/\s*$/, '')}\n\n${block}\n`;
    if (next === cur) return { file, target, changed: false };
  } else {
    next = `# ${project.name}\n\n${block}\n`;
  }
  await writeFile(file, next);
  return { file, target, changed: true };
}
