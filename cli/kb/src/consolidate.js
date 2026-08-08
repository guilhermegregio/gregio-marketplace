import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { rawDir, dailyDir } from './storage.js';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const inputDir = rawDir(date);

let files;
try {
  files = await readdir(inputDir);
} catch {
  console.error(`Sem dados raw em ${inputDir}. Rode "pnpm run pull" primeiro.`);
  process.exit(1);
}

const jsonFiles = files
  .filter(f => f.endsWith('.json') && f !== '_summary.json')
  .sort();

if (jsonFiles.length === 0) {
  console.log(`Nada pra consolidar em ${date}.`);
  process.exit(0);
}

const userId = process.env.DISCORD_USER_ID;

function formatMessage(m) {
  const author = m.author?.global_name || m.author?.username || 'unknown';
  const time = new Date(m.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  });

  let content = m.content || '';

  if (userId && content.includes(`<@${userId}>`)) {
    content = content.replaceAll(`<@${userId}>`, '@VOCÊ');
  }

  if (m.referenced_message) {
    const ref = m.referenced_message;
    const refAuthor = ref.author?.global_name || ref.author?.username || '?';
    const refContent = (ref.content || '').replace(/\s+/g, ' ').slice(0, 100);
    content = `[em resposta a ${refAuthor}: "${refContent}"] ${content}`;
  }

  if (m.attachments?.length) {
    const names = m.attachments.map(a => a.filename).join(', ');
    content += ` [anexos: ${names}]`;
  }

  if (m.embeds?.length) {
    const titles = m.embeds.map(e => e.title || e.url || '(embed)').filter(Boolean).join(', ');
    if (titles) content += ` [embeds: ${titles}]`;
  }

  return `[${time}] ${author}: ${content}`;
}

const blocks = [];
for (const f of jsonFiles) {
  const data = JSON.parse(await readFile(join(inputDir, f), 'utf8'));
  const source = data.channel
    ? `#${data.channel.name}`
    : `thread "${data.thread.name}"`;
  blocks.push(`\n=== ${source} (${data.messages.length} mensagens) ===`);
  for (const m of data.messages) {
    blocks.push(formatMessage(m));
  }
}

const transcript = blocks.join('\n');

const userMentionNote = userId
  ? `\n\nO usuário (você) tem ID Discord ${userId} — qualquer "@VOCÊ" no transcript é menção direta a ele.`
  : '';

const systemPrompt = `Você consolida conversas diárias de uma organização no Discord em um relatório estruturado em português brasileiro.

Produza UM markdown com EXATAMENTE estas seções, nesta ordem:

# Resumo do Dia — ${date}

## TL;DR
3 a 5 bullets do que foi mais relevante do dia.

## TODOs e Pendências
Tarefas mencionadas que precisam ser feitas. Para cada item: descrição clara, responsável (se mencionado), canal/thread de origem entre parênteses.

## Decisões e Alinhamentos
O que foi decidido ou alinhado, com contexto suficiente pra entender depois.

## Prazos e Datas
Datas explícitas, deadlines, eventos agendados. Liste como "DD/MM — descrição".

## Bloqueios e Riscos
Problemas levantados, dependências travadas, riscos identificados.

## Menções Diretas
Mensagens que mencionaram o usuário diretamente ou threads onde ele participou ativamente.

## Links e Recursos
URLs, documentos e arquivos compartilhados que parecem relevantes (não inclua imagens triviais ou GIFs).

## Resumo por Canal
Para cada canal/thread com atividade significativa, 1-2 linhas resumindo o tópico do dia.

REGRAS:
- Se uma seção não tiver conteúdo, escreva "_Nada relevante hoje._"
- Não invente nada que não esteja no transcript.
- Cite nomes de pessoas, canais e valores literais.
- Ignore small talk, reações puras de emoji, "bom dia", "obrigado".
- Saída deve ser SOMENTE o markdown final, sem comentários nem prefácios.${userMentionNote}`;

const fullPrompt = `${systemPrompt}\n\n---\n\nTranscript do dia ${date}:\n\n${transcript}`;

console.log(`Consolidando ${jsonFiles.length} arquivos (${transcript.length} chars) via claude CLI...`);

const outDir = dailyDir();
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, `${date}.md`);

const proc = spawn('claude', ['--print'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

let output = '';
proc.stdout.on('data', chunk => {
  output += chunk.toString();
});

proc.on('error', err => {
  console.error(`Falha ao executar claude CLI: ${err.message}`);
  console.error('Verifique se o claude code CLI está no PATH.');
  process.exit(1);
});

proc.stdin.end(fullPrompt);

const exitCode = await new Promise(resolve => proc.on('close', resolve));
if (exitCode !== 0) {
  console.error(`claude CLI saiu com código ${exitCode}`);
  process.exit(1);
}

await writeFile(outPath, output.trimEnd() + '\n');
console.log(`Relatório salvo em ${outPath}`);
