import { join } from 'node:path';
import { discoverAllSources, isForumLike } from './discord/channels.js';
import { fetchMessagesSince } from './discord/messages.js';
import { downloadAttachments } from './discord/attachments.js';
import { writeJson, rawDir, safeName } from './storage.js';

const guildId = process.env.DISCORD_GUILD_ID;
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN não definido em .env');
  process.exit(1);
}
if (!guildId) {
  console.error('DISCORD_GUILD_ID não definido em .env');
  process.exit(1);
}

const HOURS = parseInt(process.env.PULL_WINDOW_HOURS || '24', 10);
const since = Date.now() - HOURS * 60 * 60 * 1000;
const today = new Date().toISOString().slice(0, 10);
const outDir = rawDir(today);
const attachmentsRoot = join(outDir, 'attachments');

console.log(`Janela: desde ${new Date(since).toISOString()} (${HOURS}h)`);
console.log(`Guild: ${guildId}`);
console.log(`Saída: ${outDir}\n`);

console.log('Descobrindo canais e threads...');
const { channels, threads } = await discoverAllSources(guildId, since);
console.log(`  ${channels.length} canais, ${threads.length} threads com atividade na janela\n`);

const summary = {
  date: today,
  windowSinceIso: new Date(since).toISOString(),
  windowHours: HOURS,
  guildId,
  channels: [],
  threads: [],
  totalMessages: 0,
  totalAttachments: 0,
};

async function processSource(source, kind) {
  const messages = await fetchMessagesSince(source.id, since);

  if (messages.length === 0) {
    console.log(`  0 msgs`);
    return null;
  }

  let attachmentCount = 0;
  for (const m of messages) {
    if (m.attachments?.length) {
      const saved = await downloadAttachments(m, attachmentsRoot);
      m._localAttachments = saved;
      attachmentCount += saved.length;
    }
  }

  const filename = `${kind}-${safeName(source.name)}-${source.id}.json`;
  const payload = kind === 'channel'
    ? {
        channel: { id: source.id, name: source.name, type: source.type, parentId: source.parent_id ?? null },
        messages,
      }
    : {
        thread: {
          id: source.id,
          name: source.name,
          type: source.type,
          parentId: source.parent_id,
          archived: source.thread_metadata?.archived ?? false,
        },
        messages,
      };

  await writeJson(join(outDir, filename), payload);
  console.log(`  ${messages.length} msgs, ${attachmentCount} anexos -> ${filename}`);

  summary.totalMessages += messages.length;
  summary.totalAttachments += attachmentCount;

  return { id: source.id, name: source.name, messageCount: messages.length, attachmentCount, file: filename };
}

for (const channel of channels) {
  if (isForumLike(channel)) {
    console.log(`#${channel.name} (forum) — conteúdo está nas threads`);
    continue;
  }
  process.stdout.write(`#${channel.name}\n`);
  const entry = await processSource(channel, 'channel');
  if (entry) summary.channels.push(entry);
}

for (const thread of threads) {
  process.stdout.write(`  ↳ thread: ${thread.name}\n`);
  const entry = await processSource(thread, 'thread');
  if (entry) summary.threads.push({ ...entry, parentId: thread.parent_id });
}

await writeJson(join(outDir, '_summary.json'), summary);
console.log(`\nFeito. ${summary.totalMessages} mensagens, ${summary.totalAttachments} anexos.`);
console.log(`Backup raw: ${outDir}`);
