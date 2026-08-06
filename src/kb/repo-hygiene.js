import { existsSync, readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ENGINE_ROOT } from './paths.js';

// Materializa nos repos a hygiene canônica definida em templates/repo-hygiene/ (T02):
// grafo = SÓ CÓDIGO. Tudo idempotente (rodar 2x não duplica).
const HYGIENE_DIR = join(ENGINE_ROOT, 'templates', 'repo-hygiene');

// Detecta o stack simples pelo manifesto na raiz (ordem importa: flutter antes de
// node porque um repo flutter também pode ter package.json em ferramentas).
export function detectStack(repoRoot) {
  if (existsSync(join(repoRoot, 'pubspec.yaml'))) return 'flutter';
  if (existsSync(join(repoRoot, 'package.json'))) return 'node';
  if (existsSync(join(repoRoot, 'flake.nix')) || existsSync(join(repoRoot, 'default.nix'))) {
    return 'nix';
  }
  return null;
}

// Escreve .graphifyignore (base + snippet do stack), graphify-out/.gitignore (allowlist)
// e mescla .gitattributes (sem duplicar). Retorna { stack }.
// `monorepoRoot: true` → allowlist reduzida (`* !.gitignore`, sem `!graph.json`): o merge
// da RAIZ do monorepo NÃO é versionado (grande + o hook flat o clobraria). Ver
// graphify-out.monorepo-root.gitignore e o learning "monorepo root merge gitignored".
export async function applyHygiene(repoRoot, { stack, monorepoRoot = false } = {}) {
  const resolved = stack ?? detectStack(repoRoot);

  // 1. .graphifyignore = base + snippet do stack (se houver)
  let content = readFileSync(join(HYGIENE_DIR, 'graphifyignore.base'), 'utf8').replace(/\n*$/, '\n');
  if (resolved) {
    const snippet = join(HYGIENE_DIR, `graphifyignore.${resolved}`);
    if (existsSync(snippet)) content += '\n' + readFileSync(snippet, 'utf8').replace(/\n*$/, '\n');
  }
  await writeFile(join(repoRoot, '.graphifyignore'), content);

  // 2. graphify-out/.gitignore (allowlist invertida; raiz de monorepo = reduzida)
  await mkdir(join(repoRoot, 'graphify-out'), { recursive: true });
  const gitignoreTpl = monorepoRoot ? 'graphify-out.monorepo-root.gitignore' : 'graphify-out.gitignore';
  await writeFile(
    join(repoRoot, 'graphify-out', '.gitignore'),
    readFileSync(join(HYGIENE_DIR, gitignoreTpl), 'utf8'),
  );

  // 3. .gitattributes (mescla regras sem duplicar)
  await mergeGitattributes(repoRoot, readFileSync(join(HYGIENE_DIR, 'gitattributes'), 'utf8'));

  return { stack: resolved };
}

async function mergeGitattributes(repoRoot, template) {
  const dst = join(repoRoot, '.gitattributes');
  const existing = existsSync(dst) ? readFileSync(dst, 'utf8') : '';
  const have = new Set(existing.split('\n').map(l => l.trim()).filter(Boolean));
  const toAdd = template
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .filter(l => !have.has(l.trim()));
  if (!toAdd.length) return; // idempotente: já tem todas as regras

  let out = existing;
  if (out && !out.endsWith('\n')) out += '\n';
  if (!existing.includes('graphify-out/graph.json')) {
    out += (out ? '\n' : '') + '# graphify (kb project init-hygiene)\n';
  }
  out += toAdd.join('\n') + '\n';
  await writeFile(dst, out);
}

// Instala o hook post-commit/checkout do graphify (AST fresco + merge-driver union).
// Tolerante a falha: não trava o fluxo se o graphify não estiver no PATH.
export function installHook(repoRoot) {
  return new Promise(resolve => {
    let proc;
    try {
      proc = spawn('graphify', ['hook', 'install'], { cwd: repoRoot, stdio: 'ignore' });
    } catch {
      return resolve({ ok: false });
    }
    proc.on('error', () => resolve({ ok: false }));
    proc.on('close', code => resolve({ ok: code === 0 }));
  });
}
