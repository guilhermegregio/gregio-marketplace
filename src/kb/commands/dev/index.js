// Sub-dispatcher de `kb dev <sub>` — lazy-import por subcomando.
// `run` é a chave de export dos módulos simples; os de freeze exportam nomes
// próprios (um módulo, três subcomandos irmãos).
const SUB = {
  start: () => import('./start.js').then(m => m.run),
  check: () => import('./check.js').then(m => m.run),
  done: () => import('./done.js').then(m => m.run),
  run: () => import('./run.js').then(m => m.run),
  freeze: () => import('./freeze.js').then(m => m.runFreeze),
  unfreeze: () => import('./freeze.js').then(m => m.runUnfreeze),
  frozen: () => import('./freeze.js').then(m => m.runFrozen),
};

export async function run({ positionals, opts }) {
  const sub = positionals[0];
  const loader = SUB[sub];
  if (!loader) {
    console.error('uso: kb dev <start|check|run|freeze|unfreeze|frozen|done> ...');
    process.exit(1);
  }
  const fn = await loader();
  await fn({ positionals: positionals.slice(1), opts });
}
