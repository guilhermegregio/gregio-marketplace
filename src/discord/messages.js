import { discordFetch } from './client.js';

export async function fetchMessagesSince(channelId, sinceTimestamp) {
  const collected = [];
  let before = null;

  while (true) {
    const qs = new URLSearchParams({ limit: '100' });
    if (before) qs.set('before', before);

    let batch;
    try {
      batch = await discordFetch(`/channels/${channelId}/messages?${qs}`);
    } catch (err) {
      if (err.status === 403 || err.status === 404) return collected;
      console.warn(`  ! mensagens em ${channelId}: ${err.message}`);
      return collected;
    }

    if (!Array.isArray(batch) || batch.length === 0) break;

    let reachedCutoff = false;
    for (const m of batch) {
      const ts = new Date(m.timestamp).getTime();
      if (ts < sinceTimestamp) {
        reachedCutoff = true;
        break;
      }
      collected.push(m);
    }

    if (reachedCutoff || batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }

  collected.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return collected;
}
