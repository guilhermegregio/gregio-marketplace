import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, getVault, defaultVault } from '../config.js';
import { expandPath } from '../paths.js';
import { asList } from '../args.js';

export async function run({ positionals, opts }) {
  const text = positionals.join(' ').trim();
  if (!text) throw new Error('uso: kb capture "<texto>" --vault <n> [--tags x,y]');

  const config = await loadConfig();
  const vault = opts.vault ? getVault(config, opts.vault) : defaultVault(config);
  const inbox = join(expandPath(vault.path), '60-sources', '_inbox.md');
  await mkdir(join(expandPath(vault.path), '60-sources'), { recursive: true });

  const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  const tags = asList(opts.tags);
  const tagLine = tags.length ? ` ${tags.map(t => `#${t}`).join(' ')}` : '';
  const block = `\n- [ ] ${stamp} — ${text}${tagLine}\n`;

  await appendFile(inbox, block);
  console.log(`Capturado em ${inbox} (vault "${vault.name}").`);
}
