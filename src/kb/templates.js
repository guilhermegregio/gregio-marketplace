import { cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { VAULT_SKELETON } from './paths.js';

// Copia o skeleton canônico para um vault novo, substituindo tokens.
// Tokens suportados nos arquivos do skeleton: {{VAULT_NAME}}, {{VISIBILITY}}, {{DATE}}.
export async function scaffoldVault(destRoot, { vaultName, visibility }) {
  if (!existsSync(VAULT_SKELETON)) {
    throw new Error(
      `skeleton não encontrado em ${VAULT_SKELETON}. ` +
        'Crie templates/vault-skeleton/ (fase 1) antes de "kb vault new".',
    );
  }
  await cp(VAULT_SKELETON, destRoot, { recursive: true });
  await substituteTokens(destRoot, {
    VAULT_NAME: vaultName,
    VISIBILITY: visibility,
    DATE: new Date().toISOString().slice(0, 10),
  });
}

async function substituteTokens(dir, tokens) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await substituteTokens(p, tokens);
    } else if (e.name.endsWith('.md') || e.name.endsWith('.base') || e.name.endsWith('.json')) {
      let text = await readFile(p, 'utf8');
      let changed = false;
      for (const [k, v] of Object.entries(tokens)) {
        const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
        if (re.test(text)) {
          text = text.replace(re, v);
          changed = true;
        }
      }
      if (changed) await writeFile(p, text);
    }
  }
}

// Lista arquivos de scaffold compartilhado (00-meta + *.base na raiz) para o sync.
export async function listScaffoldFiles(root) {
  const files = [];
  async function walk(dir, rel) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, r);
      else files.push(r);
    }
  }
  await walk(join(root, '00-meta'), '00-meta');
  // .base na raiz
  try {
    const top = await readdir(root, { withFileTypes: true });
    for (const e of top) if (e.isFile() && e.name.endsWith('.base')) files.push(e.name);
  } catch {
    /* ignore */
  }
  return files;
}

export async function fileMtime(p) {
  try {
    return (await stat(p)).mtimeMs;
  } catch {
    return 0;
  }
}
