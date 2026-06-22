import { loadConfig, saveConfig, getGroup } from '../config.js';
import { upsertGroup, validateMembers } from '../registry.js';

export async function run({ positionals, opts }) {
  const sub = positionals[0];
  switch (sub) {
    case 'new':
      return create(positionals[1], opts);
    case 'add':
      return addMembers(positionals[1], positionals.slice(2));
    case 'rm':
      return rmMember(positionals[1], positionals[2]);
    case 'list':
      return list();
    default:
      console.error('uso: kb group <new|add|rm|list>');
      process.exit(1);
  }
}

async function create(name, opts) {
  if (!name) throw new Error('uso: kb group new <nome> [--title t]');
  const config = await loadConfig({ required: false });
  upsertGroup(config, { name, title: opts.title || name, members: getGroup(config, name)?.members ?? [] });
  await saveConfig(config);
  console.log(`Grupo "${name}" criado.`);
}

async function addMembers(name, members) {
  if (!name || !members.length) throw new Error('uso: kb group add <grupo> <membro...>');
  const config = await loadConfig();
  validateMembers(config, members);
  const g = getGroup(config, name) || { name, members: [] };
  g.members = [...new Set([...(g.members ?? []), ...members])];
  upsertGroup(config, g);
  await saveConfig(config);
  console.log(`Grupo "${name}" → ${g.members.join(', ')}`);
}

async function rmMember(name, member) {
  if (!name || !member) throw new Error('uso: kb group rm <grupo> <membro>');
  const config = await loadConfig();
  const g = getGroup(config, name);
  if (!g) throw new Error(`grupo "${name}" não existe`);
  g.members = (g.members ?? []).filter(m => m !== member);
  await saveConfig(config);
  console.log(`Removido "${member}" de "${name}".`);
}

async function list() {
  const config = await loadConfig({ required: false });
  for (const g of config.groups ?? []) {
    console.log(`${g.name}${g.title ? `  (${g.title})` : ''}`);
    console.log(`  ${(g.members ?? []).join(', ') || '(vazio)'}`);
  }
  if (!(config.groups ?? []).length) console.log('(nenhum grupo)');
}
