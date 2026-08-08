import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONFIG_PATH } from '../paths.js';

// `kb doctor` — relatório ✓/✗ do conjunto do harness.
//
// Cada check nasceu de uma dor real; não remova nenhum sem registrar o porquê:
//   - kb config ausente deixa todo o resto sem chão;
//   - plugin instalado mas DESABILITADO em enabledPlugins passou semanas despercebido;
//   - hook do guard ausente deixa freeze/wtree sem guardrail;
//   - graphify com skill desatualizada gera grafo silenciosamente velho;
//   - credencial n8n dev apontando pro auth de PROD já queimou dados reais.
//
// Exit 1 se houver qualquer ✗ — automação depende do exit code, não do texto. Check
// pulado (docker/graphify ausente) imprime `-` e não conta como falha.

const home = homedir();
const settingsPath = join(home, '.claude', 'settings.json');
const installedPluginsPath = join(home, '.claude', 'plugins', 'installed_plugins.json');

// Host de PROD do n8n — credencial dev apontando pra cá já queimou dados reais.
const N8N_PROD_HOST = 'auth.nxttrainingapp.com';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0 && !r.error, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

/**
 * Comandos de hook PreToolUse. O guard é identificado pelo COMANDO, não pelo matcher
 * (que pode evoluir): hoje `kb guard`, historicamente `node .../guard.mjs`.
 */
function preToolUseCommands(settings) {
  return (settings?.hooks?.PreToolUse ?? []).flatMap(g => (g.hooks ?? []).map(h => h.command ?? ''));
}

export async function run() {
  const results = [];
  const check = (ok, label, detail) => {
    results.push(ok);
    console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  };
  const skip = (label, detail) => console.log(`- ${label} — ${detail}`);

  // 1. kb config (respeita KB_CONFIG / XDG_CONFIG_HOME via paths.js)
  try {
    readJson(CONFIG_PATH);
    check(true, 'kb config', CONFIG_PATH);
  } catch (e) {
    check(false, 'kb config', `${CONFIG_PATH}: ${e.code === 'ENOENT' ? 'não existe' : e.message}`);
  }

  // 2. plugins instalados (scope user) precisam estar em enabledPlugins e habilitados.
  //    Plugin instalado mas desabilitado passa despercebido por semanas — dor real.
  let settings = null;
  try {
    settings = readJson(settingsPath);
  } catch (e) {
    check(false, 'settings.json', `${settingsPath}: ${e.message}`);
  }
  try {
    const installed = readJson(installedPluginsPath).plugins ?? {};
    const enabled = settings?.enabledPlugins ?? {};
    const userScoped = Object.entries(installed).filter(([, entries]) =>
      entries.some(e => e.scope === 'user'),
    );
    for (const [key] of userScoped) {
      if (enabled[key] === true) {
        check(true, `plugin ${key}`, 'habilitado');
      } else {
        check(false, `plugin ${key}`, enabled[key] === false
          ? 'instalado mas DESABILITADO em enabledPlugins'
          : 'instalado mas ausente de enabledPlugins');
      }
    }
    if (userScoped.length === 0) skip('plugins', 'nenhum plugin com scope user instalado');
  } catch (e) {
    check(false, 'plugins instalados', `${installedPluginsPath}: ${e.message}`);
  }

  // 3. hook do guard (guardrail de freeze/wtree) em hooks.PreToolUse.
  //    Transição: o guard virou subcomando (`kb guard`), mas quem ainda aponta para o
  //    guard.mjs antigo continua protegido — passa com nota de migração.
  if (settings) {
    const commands = preToolUseCommands(settings);
    const viaKb = commands.some(c => c.includes('kb guard'));
    const viaLegacy = commands.some(c => c.includes('guard.mjs'));
    if (viaKb) {
      check(true, 'hook guard em PreToolUse', 'kb guard');
    } else if (viaLegacy) {
      check(true, 'hook guard em PreToolUse', 'guard.mjs (legado) — migre o command para "kb guard"');
    } else {
      check(false, 'hook guard em PreToolUse', `guardrail de freeze/wtree ausente — adicione em ${settingsPath}: hooks.PreToolUse[{matcher:"Edit|Write|NotebookEdit", hooks:[{type:"command", command:"kb guard"}]}]`);
    }
  }

  // 4. graphify: presente e sem warning de skill desatualizada
  const g = sh('graphify', ['--version']);
  if (g.error || !g.ok) {
    check(false, 'graphify', g.error ? 'não encontrado no PATH' : g.out);
  } else {
    const warning = g.out.split('\n').find(l => /desatualizad|outdated/i.test(l));
    check(!warning, 'graphify', warning ? `warning: ${warning.trim()}` : g.out);
  }

  // 5. n8n dev: workflow importado apontando pro auth de PROD (credencial dev → prod)
  const ps = sh('docker', ['ps', '--format', '{{.Names}}']);
  if (ps.error || !ps.ok) {
    skip('n8n dev → prod', 'docker indisponível');
  } else if (!ps.out.split('\n').includes('n8n-dev')) {
    skip('n8n dev → prod', 'container n8n-dev não está rodando');
  } else {
    // $POSTGRES_USER é expandido pelo `sh -c` DE DENTRO do container — não trocar por
    // expansão local.
    const query = `psql -U $POSTGRES_USER -d n8n_dev -t -A -c "select count(*) from workflow_entity where nodes::text like '%${N8N_PROD_HOST}%'"`;
    const q = sh('docker', ['exec', 'postgres-dev', 'sh', '-c', query]);
    if (!q.ok) {
      check(false, 'n8n dev → prod', `query falhou: ${q.out || q.error?.message}`);
    } else {
      const count = Number(q.out);
      check(count === 0, 'n8n dev → prod', count === 0
        ? `nenhum workflow aponta para ${N8N_PROD_HOST}`
        : `${count} workflow(s) apontam para ${N8N_PROD_HOST} — credencial dev usando prod!`);
    }
  }

  const failures = results.filter(ok => !ok).length;
  console.log(failures ? `\n✗ ${failures} problema(s) encontrado(s)` : '\n✓ tudo certo');
  if (failures) process.exitCode = 1;
}
