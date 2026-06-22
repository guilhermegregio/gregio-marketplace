// Parser de args minimalista. Suporta:
//   --flag (boolean), --key value, --key=value, e flags repetidas (vira array).
export function parseArgs(argv) {
  const positionals = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      let key = a.slice(2);
      let value;
      if (key.includes('=')) {
        [key, value] = [key.slice(0, key.indexOf('=')), key.slice(key.indexOf('=') + 1)];
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        value = argv[++i];
      } else {
        value = true;
      }
      if (key in opts) {
        opts[key] = Array.isArray(opts[key]) ? [...opts[key], value] : [opts[key], value];
      } else {
        opts[key] = value;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, opts };
}

// Normaliza um valor de opção em array (aceita CSV e flags repetidas).
export function asList(value) {
  if (value === undefined || value === true) return [];
  if (Array.isArray(value)) return value.flatMap(v => String(v).split(',')).map(s => s.trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}
