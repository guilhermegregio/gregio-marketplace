import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_ROOT, expandPath } from './paths.js';
import { renderTokens } from './templates.js';

// Biblioteca dos blocos gerenciados do `~/.claude/CLAUDE.md` global.
//
// O engine é o dono do conteúdo (`templates/claude-home/`, um .md por bloco) e viaja com
// o pacote como o `vault-skeleton` — sem a dança do prepack, que só existe no `kb rules`
// porque lá o dono das regras é outro package.
//
// A mecânica é a do header-marcador do `kb rules`: dono único, idempotente e
// diff-friendly. O scaffold só escreve **entre os marcadores**; texto artesanal fora
// deles é intocável — numa máquina cujo CLAUDE.md nasceu à mão, os blocos são anexados ao
// fim e a migração do texto artesanal é manual e guiada. Nunca adivinhamos o que apagar.
//
// `planChanges` é pura (string entra, string sai) para que `kb scaffold` (aplicar,
// --dry-run) e `kb doctor` (detectar drift, read-only) compartilhem exatamente a mesma
// decisão — doctor que discorda do scaffold manda o humano rodar um comando que não muda
// nada. Contrato congelado: `cli/kb/behaviors.feature`.

// Escape hatch de teste/fork: KB_CLAUDE_HOME_DIR aponta outro diretório de templates.
export const CLAUDE_HOME_TEMPLATES = process.env.KB_CLAUDE_HOME_DIR
  ? expandPath(process.env.KB_CLAUDE_HOME_DIR)
  : join(ENGINE_ROOT, 'templates', 'claude-home');

const BLOCK_NAME = '[A-Za-z0-9][A-Za-z0-9._-]*';

export function beginMarker(block, version) {
  return `<!-- kb-scaffold:begin ${block} v${version} -->`;
}

export function endMarker(block) {
  return `<!-- kb-scaffold:end ${block} -->`;
}

/** Bloco renderizado: marcador de abertura + miolo + marcador de fechamento. */
export function renderBlock(template) {
  return `${beginMarker(template.block, template.version)}\n${template.body.trim()}\n${endMarker(template.block)}`;
}

/** Frontmatter mínimo: `block`, `profiles`, `order`, `version`. Sem dep de parser YAML. */
function readBlockMeta(dir, file) {
  const raw = readFileSync(join(dir, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = { block: file.replace(/\.md$/, ''), profiles: ['all'], order: 100, version: 1 };
  if (fm) {
    const block = fm[1].match(/^block:\s*(\S+)/m);
    const profiles = fm[1].match(/^profiles:\s*\[(.*)\]/m);
    const order = fm[1].match(/^order:\s*(\d+)/m);
    const version = fm[1].match(/^version:\s*(\d+)/m);
    if (block) meta.block = block[1];
    if (profiles) meta.profiles = profiles[1].split(',').map(s => s.trim()).filter(Boolean);
    if (order) meta.order = Number(order[1]);
    if (version) meta.version = Number(version[1]);
  }
  return { ...meta, file, body: fm ? raw.slice(fm[0].length) : raw };
}

/** Blocos disponíveis, já na ordem em que são escritos no arquivo final. */
export function readTemplates(dir = CLAUDE_HOME_TEMPLATES) {
  if (!existsSync(dir)) {
    throw new Error(
      `templates do CLAUDE.md global não encontrados em ${dir}. ` +
        'Aponte KB_CLAUDE_HOME_DIR para o diretório templates/claude-home/.',
    );
  }
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => readBlockMeta(dir, f))
    .sort((a, b) => a.order - b.order || a.block.localeCompare(b.block));
}

/**
 * Substitui `{{TOKEN}}` no miolo dos blocos (ex.: `{{FASTFETCH}}` do bloco os-info).
 * Quem captura os valores é o comando; `planChanges` recebe os templates já renderizados.
 */
export function renderTemplates(templates, tokens) {
  return templates.map(t => ({ ...t, body: renderTokens(t.body, tokens) }));
}

/** Perfis oferecidos pelo manifest (o `all` não é escolha — está sempre ativo). */
export function listProfiles(templates) {
  const out = new Set();
  for (const t of templates) for (const p of t.profiles) if (p !== 'all') out.add(p);
  return [...out].sort();
}

/** Blocos que entram: os `all` mais os dos perfis ativos. Preserva a ordem do manifest. */
export function selectTemplates(templates, activeProfiles = []) {
  const active = new Set(activeProfiles);
  return templates.filter(t => t.profiles.includes('all') || t.profiles.some(p => active.has(p)));
}

/**
 * Blocos já instalados no texto, com as posições dos marcadores.
 * Bloco sem marcador de fim é ignorado (arquivo mexido à mão) — na dúvida, não tocamos.
 */
export function parseBlocks(text) {
  const begin = new RegExp(`<!-- kb-scaffold:begin (${BLOCK_NAME}) v(\\d+) -->`, 'g');
  const found = [];
  let m;
  while ((m = begin.exec(text)) !== null) {
    const [marker, block, version] = m;
    const end = endMarker(block);
    const endAt = text.indexOf(end, m.index + marker.length);
    if (endAt === -1) continue;
    found.push({
      block,
      version: Number(version),
      start: m.index,
      end: endAt + end.length,
      body: text.slice(m.index + marker.length, endAt).replace(/^\n|\n$/g, ''),
    });
    begin.lastIndex = endAt + end.length;
  }
  return found;
}

/** Junta duas metades de texto onde um bloco foi removido, sem inventar linha em branco. */
function joinSeam(before, after, isTail) {
  if (before === '') return after.replace(/^\n+/, '');
  const gap = (before.match(/\n*$/)?.[0].length ?? 0) + (after.match(/^\n*/)?.[0].length ?? 0);
  const head = before.replace(/\n*$/, '');
  const tail = after.replace(/^\n+/, '');
  if (tail === '' && isTail) return `${head}\n`;
  return head + '\n'.repeat(Math.min(gap, 2)) + tail;
}

/**
 * Decide o que fazer com o CLAUDE.md, sem I/O. Regras (contrato congelado):
 *  - bloco na mesma versão → não toca (nem se o miolo foi editado à mão);
 *  - versão menor que a do template → substitui só o miolo, no lugar em que está;
 *  - bloco de perfil desativado → removido (só o que tem marcador);
 *  - bloco sem template correspondente → deixado quieto (engine velho não apaga bloco
 *    que ele não sabe recriar), reportado em `orphans`;
 *  - bloco novo → anexado ao fim, na ordem do manifest;
 *  - texto fora dos marcadores → intocável.
 */
export function planChanges(claudeMdText, templates, activeProfiles = []) {
  const text = claudeMdText ?? '';
  const selected = selectTemplates(templates, activeProfiles);
  const byBlock = new Map(templates.map(t => [t.block, t]));
  const selectedNames = new Set(selected.map(t => t.block));
  const installed = parseBlocks(text);

  const writes = [];
  const updates = [];
  const removes = [];
  const unchanged = [];
  const orphans = [];
  const action = new Map();

  for (const inst of installed) {
    const tpl = byBlock.get(inst.block);
    if (!tpl) {
      orphans.push({ block: inst.block, version: inst.version });
      action.set(inst, 'keep');
    } else if (!selectedNames.has(inst.block)) {
      removes.push({ block: inst.block, version: inst.version });
      action.set(inst, 'remove');
    } else if (inst.version < tpl.version) {
      updates.push({ block: inst.block, from: inst.version, to: tpl.version });
      action.set(inst, 'update');
    } else {
      unchanged.push({ block: inst.block, version: inst.version });
      action.set(inst, 'keep');
    }
  }

  const installedNames = new Set(installed.map(b => b.block));
  const toAppend = selected.filter(t => !installedNames.has(t.block));
  for (const t of toAppend) writes.push({ block: t.block, version: t.version, file: t.file });

  // Reescrita: só as regiões marcadas mudam; cada pedaço de texto artesanal é copiado
  // como está, byte a byte.
  let out = '';
  let cursor = 0;
  let seam = false;
  for (const inst of installed) {
    const gap = text.slice(cursor, inst.start);
    out = seam ? joinSeam(out, gap, false) : out + gap;
    seam = false;
    const what = action.get(inst);
    if (what === 'remove') seam = true;
    else if (what === 'update') out += renderBlock(byBlock.get(inst.block));
    else out += text.slice(inst.start, inst.end);
    cursor = inst.end;
  }
  const rest = text.slice(cursor);
  out = seam ? joinSeam(out, rest, true) : out + rest;

  if (toAppend.length) {
    const blocks = toAppend.map(renderBlock).join('\n\n');
    const head = out.replace(/\s*$/, '');
    out = head ? `${head}\n\n${blocks}\n` : `${blocks}\n`;
  }

  return {
    writes,
    updates,
    removes,
    unchanged,
    orphans,
    resultText: out,
    changed: writes.length > 0 || updates.length > 0 || removes.length > 0,
  };
}
