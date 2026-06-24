// Sub-dispatcher de `kb dev <sub>` — lazy-import por subcomando.
const SUB = {
  start: () => import('./start.js'),
  check: () => import('./check.js'),
  done: () => import('./done.js'),
  run: () => import('./run.js'),
};

export async function run({ positionals, opts }) {
  const sub = positionals[0];
  const loader = SUB[sub];
  if (!loader) {
    console.error('uso: kb dev <start|check|done|run> ...');
    process.exit(1);
  }
  const mod = await loader();
  await mod.run({ positionals: positionals.slice(1), opts });
}
