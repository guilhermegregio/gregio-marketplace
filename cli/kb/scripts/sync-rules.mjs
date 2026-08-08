#!/usr/bin/env node
// prepack: espelha `packages/gregio-cc-rules/rules/` em `cli/kb/rules/`.
//
// Por que existe: `kb rules` não é dono do conteúdo das rules — o package
// `gregio-cc-rules` é. Num checkout do marketplace o comando acha as rules dois níveis
// acima; num tarball do npm esse caminho não existe, então as rules precisam viajar
// DENTRO do pacote. Este script é o único ponto que faz essa cópia, e roda no `prepack`
// (npm pack / npm publish), nunca em runtime.
//
// `cli/kb/rules/` é gerado, não versionado (está no .gitignore da raiz).
// Node puro, sem dependências; idempotente — remove órfãos e reescreve o resto.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ENGINE_ROOT, '..', '..', 'packages', 'gregio-cc-rules', 'rules');
const TARGET = join(ENGINE_ROOT, 'rules');

if (!existsSync(SOURCE)) {
  // Falhar alto: publicar sem as rules gera um pacote em que `kb rules` não acha nada.
  console.error(`sync-rules: fonte não encontrada: ${SOURCE}`);
  process.exit(1);
}

const files = readdirSync(SOURCE).filter(f => f.endsWith('.md'));
if (files.length === 0) {
  console.error(`sync-rules: nenhuma rule (*.md) em ${SOURCE}`);
  process.exit(1);
}

mkdirSync(TARGET, { recursive: true });

const keep = new Set(files);
for (const existing of readdirSync(TARGET)) {
  if (!keep.has(existing)) rmSync(join(TARGET, existing), { recursive: true, force: true });
}

for (const file of files) copyFileSync(join(SOURCE, file), join(TARGET, file));

console.log(`sync-rules: ${files.length} rule(s) copiada(s) para ${TARGET}`);
