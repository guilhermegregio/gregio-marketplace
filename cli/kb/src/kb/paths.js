import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));

// Raiz do engine (knowledge-gregio/). src/kb/ -> ../..
export const ENGINE_ROOT = resolve(here, '..', '..');

// O exemplo e o skeleton vivem NO repo (são parte do código).
export const CONFIG_EXAMPLE_PATH = join(ENGINE_ROOT, 'kb.config.example.json');
export const VAULT_SKELETON = join(ENGINE_ROOT, 'templates', 'vault-skeleton');

// Expande ~ e resolve para absoluto.
export function expandPath(p) {
  if (!p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return resolve(p);
}

// --- Estado do engine via XDG (config do usuário + artefato derivado) ---
// Overrides: KB_CONFIG (caminho do arquivo), XDG_CONFIG_HOME, XDG_STATE_HOME.
const XDG_CONFIG = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const XDG_STATE = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');

export const CONFIG_DIR = join(XDG_CONFIG, 'kb');
export const STATE_DIR = join(XDG_STATE, 'kb');

// config.json (registro de vaults/projetos/grupos) — KB_CONFIG sobrescreve tudo.
export const CONFIG_PATH = process.env.KB_CONFIG
  ? expandPath(process.env.KB_CONFIG)
  : join(CONFIG_DIR, 'config.json');

// grafo central merge-ado (derivado, regenerável, mistura visibilidades → fica local).
export const CENTRAL_GRAPH_DEFAULT = join(STATE_DIR, 'central-graph.json');
