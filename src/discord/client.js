const BASE = 'https://discord.com/api/v10';
const MIN_INTERVAL_MS = 200;

let nextRequestAt = 0;
let throttleChain = Promise.resolve();

function reserveSlot() {
  const next = throttleChain.then(async () => {
    const now = Date.now();
    if (now < nextRequestAt) {
      await new Promise(r => setTimeout(r, nextRequestAt - now));
    }
    nextRequestAt = Date.now() + MIN_INTERVAL_MS;
  });
  throttleChain = next;
  return next;
}

export async function discordFetch(path, options = {}) {
  await reserveSlot();
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'User-Agent': 'knowledge-gregio (self, 0.1.0)',
      ...options.headers,
    },
  });

  if (res.status === 429) {
    let retryAfter = 1000;
    try {
      const body = await res.json();
      retryAfter = Math.ceil((body.retry_after ?? 1) * 1000);
    } catch {}
    console.warn(`  ! 429, esperando ${retryAfter}ms`);
    await new Promise(r => setTimeout(r, retryAfter));
    return discordFetch(path, options);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Discord ${res.status} ${path}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}
