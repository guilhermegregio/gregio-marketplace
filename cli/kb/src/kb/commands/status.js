import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { findOrphanWorktreeDirs, findRepos, hasWarnings, repoStatus } from '../repo-status.js';

// `kb status [dir] [--all]` — onde há trabalho não salvo.
//
// Nasceu de `~/code/check-uncommitted.sh` e cresceu para os riscos que o fluxo com
// worktree cria: branch não mergeada (o `wtree --rm -f` apaga sem perguntar) e sobras
// em `~/code/worktrees`. Sem `--all` só aparece o que tem risco — quem roda isso antes
// de trocar de contexto não quer scroll.
//
// Exit 1 só conta finding `warn` (perde trabalho se ignorar); `info` é contexto.

export async function run({ positionals, opts }) {
  const all = opts.all === true;
  const baseDir = resolve(positionals[0] ?? join(homedir(), 'code'));
  const repos = findRepos(baseDir);
  if (!repos.length) console.log(`nenhum repo git em ${baseDir}`);

  let risky = 0;
  for (const repo of repos) {
    const st = repoStatus(repo);
    const warn = hasWarnings(st);
    if (warn) risky += 1;
    if (!warn && !all) continue;

    console.log(`${warn ? '⚠️ ' : '✓ '} ${basename(repo)}`);
    if (st.error) console.log(`     ✗ ${st.error}`);
    for (const f of st.findings) {
      console.log(`     ${f.level === 'warn' ? '•' : '·'} ${f.what}: ${f.detail}`);
    }
  }

  // Sobras de worktree: o git não as conhece mais, então nenhum repo as reporta.
  const worktreesDir = join(baseDir, 'worktrees');
  const orphans = findOrphanWorktreeDirs(worktreesDir);
  if (orphans.length) {
    console.log(`\n⚠️  ${orphans.length} diretório(s) órfão(s) em ${worktreesDir}:`);
    for (const o of orphans) {
      console.log(`     ${basename(o.path)}  → confira e apague: rm -rf ${o.path}`);
      if (o.foreignOwner) {
        // Volume de container (supabase local etc.) deixa restos de outro dono:
        // o rm do usuário falha com "Permissão negada".
        console.log('       ⤷ contém arquivos de OUTRO dono (volume de container).');
        console.log('         Se der "Permissão negada", apague pela mesma via que criou:');
        console.log(`         docker run --rm -v ${dirname(o.path)}:/w alpine rm -rf /w/${basename(o.path)}`);
      }
    }
    risky += orphans.length;
  }

  console.log(
    risky
      ? `\n${risky} item(ns) com trabalho não salvo — commit, push, merge ou descarte antes de trocar de contexto.`
      : `\n✓ ${repos.length} repo(s) limpos.`,
  );
  if (risky) process.exitCode = 1;
}
