import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));

// Raiz do engine (knowledge-gregio/). src/kb/ -> ../..
export const ENGINE_ROOT = resolve(here, '..', '..');

export const CONFIG_PATH = join(ENGINE_ROOT, 'kb.config.json');
export const CONFIG_EXAMPLE_PATH = join(ENGINE_ROOT, 'kb.config.example.json');
export const VAULT_SKELETON = join(ENGINE_ROOT, 'templates', 'vault-skeleton');

// Expande ~ e resolve para absoluto.
export function expandPath(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return resolve(p);
}
