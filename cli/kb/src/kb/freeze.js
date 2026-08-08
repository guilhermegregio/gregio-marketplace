import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { STATE_DIR } from './paths.js';

// Freeze de contratos (behaviors.feature) — devflow v2.
//
// O contrato Gherkin é escrito ANTES do código e aprovado pelo humano. Durante a
// implementação ele não pode ser editado: cenário quebrando significa "o código está
// errado", não "o cenário estava otimista". Sem isso, o agente conserta o teste em vez
// do bug — e o contrato deixa de valer.
//
// O estado vive num índice único (fora dos vaults) para o hook do Claude Code
// consultar em O(1) sem varrer plano nenhum.

export const FREEZE_INDEX = join(STATE_DIR, 'frozen-contracts.json');

export async function readIndex() {
  if (!existsSync(FREEZE_INDEX)) return { version: 1, entries: [] };
  try {
    const parsed = JSON.parse(await readFile(FREEZE_INDEX, 'utf8'));
    return parsed?.entries ? parsed : { version: 1, entries: [] };
  } catch {
    // Índice corrompido não pode travar o fluxo — o pior caso é não bloquear.
    return { version: 1, entries: [] };
  }
}

async function writeIndex(index) {
  await mkdir(dirname(FREEZE_INDEX), { recursive: true });
  await writeFile(FREEZE_INDEX, `${JSON.stringify(index, null, 2)}\n`);
}

export async function sha(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex').slice(0, 16);
}

/** Congela os arquivos de um plano. Idempotente: re-freeze atualiza os hashes. */
export async function freeze({ plan, vault, files }) {
  const index = await readIndex();
  index.entries = index.entries.filter(e => !(e.plan === plan && e.vault === vault));
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`contrato não existe: ${file}`);
    index.entries.push({ plan, vault, file, sha: await sha(file), frozen_at: new Date().toISOString() });
  }
  await writeIndex(index);
  return index.entries.filter(e => e.plan === plan);
}

/** Descongela — total (fim do plano) ou um arquivo (mudança de contrato autorizada). */
export async function unfreeze({ plan, vault, file = null }) {
  const index = await readIndex();
  const before = index.entries.length;
  index.entries = index.entries.filter(e => {
    if (e.plan !== plan || e.vault !== vault) return true;
    return file ? e.file !== file : false;
  });
  await writeIndex(index);
  return before - index.entries.length;
}

/** Entrada de freeze que cobre este arquivo, se houver. Usado pelo hook. */
export async function frozenEntryFor(filePath) {
  const index = await readIndex();
  return index.entries.find(e => e.file === filePath) ?? null;
}

/** Arquivos congelados cujo conteúdo mudou desde o freeze. */
export async function driftedFiles(plan = null) {
  const index = await readIndex();
  const out = [];
  for (const e of index.entries) {
    if (plan && e.plan !== plan) continue;
    if (!existsSync(e.file)) {
      out.push({ ...e, reason: 'arquivo removido' });
      continue;
    }
    const current = await sha(e.file);
    if (current !== e.sha) out.push({ ...e, reason: 'conteúdo alterado', current });
  }
  return out;
}
