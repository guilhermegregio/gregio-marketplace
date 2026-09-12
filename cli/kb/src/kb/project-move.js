import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative } from 'node:path';
import { loadConfig, saveConfig, getProject } from './config.js';
import { expandPath } from './paths.js';
import { FREEZE_INDEX, readIndex } from './freeze.js';
import { houseFaces, houseFolderCandidates, linkClaudeMd, resolveVaultTarget, targetLabel } from './repo-claudemd.js';
import { listActivePlans, regenerateVaultIndex } from './vault-index.js';

// `kb project move <nome> --to-vault <v> [--from-vault v] [--dry-run] [--no-link]`
//
// Migra a casa do projeto (10-projects/<pasta>/ inteira, behaviors/ incluso) de um vault
// para outro sem deixar nada apontando para o lugar velho: identidade (`id` com prefixo
// do vault) e `visibility` das notas, `vault` na config, contratos congelados, ponteiro
// do CLAUDE.md e índices dos dois vaults.
//
// Planos NÃO se movem: plano é cross-projeto e mora no vault onde foi aberto; o comando
// só avisa quantos planos ativos da origem citam o projeto.
//
// Tudo que pode falhar é checado antes da primeira escrita (destino ocupado, vault
// desconhecido, origem ambígua) — falha não deixa meio-movimento para trás. Commit fica
// com o humano: o comando lembra quais repos ficaram sujos.

const USAGE = 'uso: kb project move <nome> --to-vault <v> [--from-vault v] [--dry-run] [--no-link]';

function mdFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Reescreve `id:` (prefixo do vault) e `visibility:` no frontmatter por linha — preserva
// a formatação do resto (stringify reordenaria e re-citaria o arquivo inteiro).
function rewriteFrontmatter(text, { fromVault, toVault, visibility, isProject, folder }) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!m) return { text, changes: [] };
  const changes = [];
  const fm = m[0]
    .replace(/^id:[ \t]*(.*)$/m, (line, raw) => {
      const id = raw.trim().replace(/^["']|["']$/g, '');
      let next = id;
      if (id.startsWith(`${fromVault}-`)) next = `${toVault}-${id.slice(fromVault.length + 1)}`;
      else if (isProject) next = `${toVault}-project-${folder}`;
      if (next === id) return line;
      changes.push(`id: ${id} → ${next}`);
      return `id: ${next}`;
    })
    .replace(/^visibility:[ \t]*(.*)$/m, (line, raw) => {
      const cur = raw.trim().replace(/^["']|["']$/g, '');
      if (!visibility || cur === visibility) return line;
      changes.push(`visibility: ${cur || '(vazio)'} → ${visibility}`);
      return `visibility: ${visibility}`;
    });
  return { text: fm + text.slice(m[0].length), changes };
}

function git(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

// Planos ativos da origem que citam o projeto (frontmatter `projects` ou o path da casa).
function plansCiting(vaultRoot, project, folder) {
  const names = new Set([project.name, folder]);
  return listActivePlans(vaultRoot)
    .filter(p => p.hasPlan)
    .filter(p => {
      const projects = Array.isArray(p.fm.projects) ? p.fm.projects : [p.fm.projects];
      if (projects.some(x => names.has(x))) return true;
      const text = readFileSync(join(vaultRoot, '30-plans', p.slug, '_plan.md'), 'utf8');
      return text.includes(`10-projects/${folder}/`);
    })
    .map(p => p.slug);
}

export async function moveProject(name, opts) {
  const toName = opts['to-vault'];
  if (!name || typeof toName !== 'string') throw new Error(USAGE);
  const dryRun = opts['dry-run'] === true;
  const noLink = opts['no-link'] === true;

  const config = await loadConfig();
  const project = getProject(config, name);
  if (!project) throw new Error(`projeto "${name}" não registrado (veja "kb project list")`);

  const vaults = config.vaults ?? [];
  const valid = vaults.map(v => v.name).join(', ');
  const to = vaults.find(v => v.name === toName);
  if (!to) throw new Error(`vault "${toName}" desconhecido — válidos: ${valid}`);

  // --- Origem: a face fora do destino (preferindo a resolvida pela config) ----------
  const faces = houseFaces(config, project).filter(f => f.vaultName !== to.name);
  let face;
  if (opts['from-vault'] !== undefined) {
    face = faces.find(f => f.vaultName === opts['from-vault']);
    if (!face) throw new Error(`"${name}" não tem casa no vault "${opts['from-vault']}"`);
  } else {
    const resolved = resolveVaultTarget(config, project);
    face = faces.find(f => f.vaultName === resolved?.vaultName) ?? (faces.length === 1 ? faces[0] : null);
    if (!face && faces.length > 1) {
      throw new Error(
        `"${name}" tem casa em ${faces.map(f => f.vaultName).join(', ')} — diga a origem com --from-vault <v>`,
      );
    }
  }
  if (!face) {
    const cands = houseFolderCandidates(project).map(c => `10-projects/${c}/`).join(' ou ');
    throw new Error(`"${name}" não tem casa (${cands}) em nenhum vault além de "${to.name}"`);
  }
  const from = vaults.find(v => v.name === face.vaultName);
  const folder = face.folder;
  const fromRoot = expandPath(from.path);
  const toRoot = expandPath(to.path);
  const src = face.dir;
  const dst = join(toRoot, '10-projects', folder);

  if (!existsSync(toRoot)) throw new Error(`vault destino "${to.name}" sem path em disco (${to.path})`);
  if (existsSync(dst)) {
    throw new Error(`a casa já existe no destino: ${targetLabel({ vaultName: to.name, folder })} — nada foi alterado`);
  }

  // --- Plano do movimento (tudo calculado antes de escrever) ----------------------
  const visibility = to.visibility ?? config.defaults?.visibility;
  const rewrites = [];
  for (const file of mdFiles(src)) {
    const rel = relative(src, file);
    const { text, changes } = rewriteFrontmatter(await readFile(file, 'utf8'), {
      fromVault: from.name,
      toVault: to.name,
      visibility,
      isProject: rel === '_project.md',
      folder,
    });
    if (changes.length) rewrites.push({ rel, text, changes });
  }

  const index = await readIndex();
  const prefix = `${src}/`;
  const contracts = index.entries.filter(e => e.file.startsWith(prefix));

  const plans = plansCiting(fromRoot, project, folder);
  const repoRoot = expandPath(project.path);
  const fromLabel = targetLabel({ vaultName: from.name, folder });
  const toLabel = targetLabel({ vaultName: to.name, folder });

  const tag = dryRun ? '[dry-run] ' : '';
  console.log(`${tag}mover "${name}"`);
  console.log(`  origem:  ${src}  (${fromLabel})`);
  console.log(`  destino: ${dst}  (${toLabel})`);
  console.log(`  frontmatter (${rewrites.length} arquivo(s)):`);
  for (const r of rewrites) console.log(`    ${r.rel}: ${r.changes.join(' · ')}`);
  if (!rewrites.length) console.log('    (nada a reescrever)');
  console.log(`  config: projects[${name}].vault = "${to.name}"`);
  console.log(`  contratos congelados afetados: ${contracts.length}`);
  for (const e of contracts) console.log(`    ${e.file} → ${dst}/${e.file.slice(prefix.length)}  (plano ${e.plan})`);
  console.log(`  CLAUDE.md do repo: ${noLink ? 'intocado (--no-link)' : `ponteiro → ${toLabel}`}`);

  if (dryRun) {
    warnPlans(plans, from);
    console.log('\n--dry-run: nada foi escrito.');
    return;
  }

  // --- Execução ------------------------------------------------------------------
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true, errorOnExist: true, force: false });
  for (const r of rewrites) await writeFile(join(dst, r.rel), r.text);

  // git rm na origem (stagia a remoção dos rastreados); o que sobrar é não-rastreado.
  const relSrc = relative(fromRoot, src);
  const gitRm = git(fromRoot, ['rm', '-r', '-q', '--ignore-unmatch', '--', relSrc]);
  if (gitRm.status !== 0) console.warn(`  ! git rm em ${basename(fromRoot)} falhou: ${(gitRm.stderr || '').trim()}`);
  if (existsSync(src)) await rm(src, { recursive: true, force: true });

  project.vault = to.name;
  await saveConfig(config);

  if (contracts.length) {
    for (const e of contracts) e.file = join(dst, e.file.slice(prefix.length));
    await mkdir(dirname(FREEZE_INDEX), { recursive: true });
    await writeFile(FREEZE_INDEX, `${JSON.stringify(index, null, 2)}\n`);
  }

  console.log(`\n✓ casa movida para ${toLabel}`);
  if (contracts.length) console.log(`✓ ${contracts.length} contrato(s) congelado(s) repontado(s) (mesmo sha)`);

  if (noLink) {
    console.log(`! ponteiro do CLAUDE.md pendente — rode: kb project link-claude ${name}`);
  } else if (!existsSync(repoRoot)) {
    console.log(`! repo ausente (${repoRoot}) — ponteiro pendente: kb project link-claude ${name}`);
  } else {
    const { changed } = await linkClaudeMd(repoRoot, config, project);
    console.log(`✓ CLAUDE.md ${changed ? 'aponta agora' : 'já apontava'} para ${toLabel}`);
  }

  for (const v of [from, to]) {
    const res = await regenerateVaultIndex(v);
    const touched = res.filter(r => r.changed).map(r => r.rel);
    console.log(`✓ índices de ${v.name} regenerados${touched.length ? ` (${touched.join(', ')})` : ' (já em dia)'}`);
  }

  warnPlans(plans, from);
  const repos = [basename(fromRoot), basename(toRoot)];
  console.log(`\nLembre de commitar: ${repos.join(', ')}${noLink ? '' : ` e o repo (${repoRoot})`}.`);
}

function warnPlans(plans, from) {
  if (!plans.length) return;
  console.log(
    `! ${plans.length} plano(s) ativo(s) em vault-${from.name}/30-plans/ citam o projeto e continuam lá ` +
      `(planos não se movem): ${plans.join(', ')}`,
  );
}
