#!/usr/bin/env node
// Deprecado: o harness virou subcomando do engine kb (cli/kb).
console.error('harness.mjs foi removido — use: kb doctor | kb status [dir] [--all] | kb map');
console.error('  (install <repo> virou: kb rules <repo> + hook "kb guard" no settings.json)');
process.exit(1);
