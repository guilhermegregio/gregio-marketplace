import { discordFetch } from './client.js';

export const CHANNEL_TYPE = {
  TEXT: 0,
  ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  FORUM: 15,
  MEDIA: 16,
};

const TEXTLIKE = new Set([
  CHANNEL_TYPE.TEXT,
  CHANNEL_TYPE.ANNOUNCEMENT,
  CHANNEL_TYPE.FORUM,
  CHANNEL_TYPE.MEDIA,
]);

export function isForumLike(channel) {
  return channel.type === CHANNEL_TYPE.FORUM || channel.type === CHANNEL_TYPE.MEDIA;
}

export async function listGuildChannels(guildId) {
  const channels = await discordFetch(`/guilds/${guildId}/channels`);
  return channels.filter(c => TEXTLIKE.has(c.type));
}

export async function listActiveThreads(guildId) {
  const data = await discordFetch(`/guilds/${guildId}/threads/active`);
  return data.threads || [];
}

export async function listArchivedThreadsSince(channelId, sinceTimestamp) {
  const collected = [];
  let beforeIso = null;

  while (true) {
    const qs = new URLSearchParams({ limit: '100' });
    if (beforeIso) qs.set('before', beforeIso);

    let data;
    try {
      data = await discordFetch(`/channels/${channelId}/threads/archived/public?${qs}`);
    } catch (err) {
      if (err.status === 403 || err.status === 404) return collected;
      console.warn(`  ! arquivadas em ${channelId}: ${err.message}`);
      return collected;
    }

    const threads = data.threads || [];
    if (threads.length === 0) break;

    let stop = false;
    for (const t of threads) {
      const archivedAt = new Date(t.thread_metadata?.archive_timestamp || 0).getTime();
      if (archivedAt < sinceTimestamp) {
        stop = true;
        break;
      }
      collected.push(t);
    }

    if (stop || !data.has_more) break;
    const last = threads[threads.length - 1];
    beforeIso = last.thread_metadata?.archive_timestamp;
    if (!beforeIso) break;
  }

  return collected;
}

export async function discoverAllSources(guildId, sinceTimestamp) {
  const exclude = new Set(
    (process.env.EXCLUDE_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  const allChannels = await listGuildChannels(guildId);
  const channels = allChannels.filter(c => !exclude.has(c.id));

  const activeThreads = await listActiveThreads(guildId);

  const archivedNested = [];
  for (const c of channels) {
    const threads = await listArchivedThreadsSince(c.id, sinceTimestamp);
    archivedNested.push(...threads);
  }

  const threadMap = new Map();
  for (const t of [...activeThreads, ...archivedNested]) {
    if (exclude.has(t.parent_id)) continue;
    if (!channels.some(c => c.id === t.parent_id)) continue;
    threadMap.set(t.id, t);
  }

  return {
    channels,
    threads: [...threadMap.values()],
  };
}
