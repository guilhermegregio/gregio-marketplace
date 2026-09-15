# gregio-cc-harness — manutenção

Package **fino**: a implementação mudou de casa. `scaffold`, `doctor`, `status`,
`map`, `rules` e `guard` são subcomandos do engine `kb`
(`cli/kb/src/kb/commands/`); aqui ficam só a doc do consumidor (README) e os
contratos abaixo.

| aqui era | agora é | código |
|---|---|---|
| `scripts/harness.mjs doctor` | `kb doctor` | `cli/kb/src/kb/commands/doctor.js` |
| `scripts/harness.mjs status` | `kb status` | `cli/kb/src/kb/commands/status.js` + `cli/kb/src/kb/repo-status.js` |
| `scripts/harness.mjs map` | `kb map` | `cli/kb/src/kb/commands/map.js` |
| `scripts/harness.mjs install` | `kb rules <repo>` + hook `kb guard` | `commands/rules.js`, `commands/guard.js` |
| (não existia) | `kb scaffold` | `commands/scaffold.js` + `cli/kb/src/kb/claude-home.js` + `cli/kb/templates/claude-home/` |

`scripts/harness.mjs` é stub de deprecação (aponta o comando `kb` e sai 1) — não
ressuscite lógica aqui.

## Contratos que não podem regredir

- **Check só entra com cicatriz, e a cicatriz fica comentada no código.** Cada
  check do `kb doctor` rastreia uma dor real, registrada no comentário acima dele
  em `commands/doctor.js`: plugin instalado mas desabilitado em `enabledPlugins`
  passou semanas despercebido; guard ausente deixa freeze/wtree sem guardrail;
  rules que não resolvem só falham na hora do `kb rules`, já dentro do repo alvo;
  ferramenta do CLAUDE.md global faltando faz o agente obedecer a uma regra que a
  máquina não sustenta e travar sem dizer por quê; bloco do CLAUDE.md em versão
  velha é regra desatualizada seguida ao pé da letra, pior que regra ausente.
  Check novo sem cicatriz escrita é ruído — e não se remove um check sem registrar
  o porquê (abaixo).
- **O doctor valida o harness, não a estação de quem o mantém.** Este código é
  público e roda na máquina de outras pessoas: hostname interno, repo pessoal e
  alias de quem mantém não entram no engine. Cicatriz que é da estação de alguém
  vira `doctor.checks` na config **daquele** usuário.
- **`kb doctor` sai com 1 se qualquer ✗** — automação depende do exit code, não
  do texto. Check pulado (graphify ausente, plataforma em que o check não se
  aplica, `skip_if` de um check da config) imprime `-` e não conta como falha.
- **`kb doctor` é read-only ABSOLUTO.** Ele diagnostica e imprime o comando de
  correção (`kb scaffold`, o pacote a instalar); quem conserta é o humano. Duas
  execuções seguidas têm de imprimir exatamente a mesma coisa e não tocar em nada
  — doctor que conserta sozinho vira ferramenta que ninguém roda com medo. Um
  check `command` da config do usuário é responsabilidade dele: a doc pede comando
  somente-leitura, e o engine não tem como garantir isso por ele.
- **A resolução do diretório de rules tem dono único.** O check "rules
  disponíveis" importa `findRulesDir` de `commands/rules.js` — se o doctor
  repetisse a cadeia de candidatos, daria ✓ num caminho que o `kb rules` não
  acharia (ou o contrário).
- **Os hooks do plugin (`hooks/`) só fazem valer regra que o `kb scaffold` escreve.**
  Cada hook corresponde a um bloco do CLAUDE.md global (`core`, `herdr`) ou ao
  `kb guard`; regra de estação não entra. Por isso a notificação é ponto de extensão
  (`claude-notify` do PATH, se existir) e não um script de quem mantém — este repo é
  público. Scripts em `sh` + `jq`, sem bashismo: rodam igual no macOS.
- **O doctor procura o guard no `settings.json` E nos plugins habilitados**
  (`<installPath>/hooks/hooks.json`). Quem migrou para o plugin não pode ver ✗ falso;
  plugin desabilitado não conta, porque o Claude Code não roda os hooks dele.
- **O check do hook aceita os dois mundos durante a transição**: `kb guard` (o
  jeito novo) e `guard.mjs` (instalações antigas continuam protegidas) — o
  legado passa com nota de migração, não com ✗. Quem já migrou não pode ver
  falha falsa; quem não migrou não pode achar que está desprotegido.
- **`kb rules` NUNCA duplica o conteúdo das rules.** As rules moram em
  `packages/gregio-cc-rules/rules`; o comando só resolve o diretório (env
  `KB_RULES_DIR` → path relativo ao engine → plugin cache) e copia. Auto-detecção
  de stack, idempotência e `--prune` têm dono único.
- **`kb map` não executa nada** — só sugere `kb project add`.

### Checks removidos (e por quê) — 2026-08-30

Três checks saíram do `commands/doctor.js` porque eram do **ecossistema de quem
mantém**, não do harness — e este repo é público:

| check removido | o que validava | por que saiu | para onde foi |
|---|---|---|---|
| `n8n dev → prod` | nenhum workflow do `n8n-dev` apontando para o host de auth de produção | tinha o **hostname interno hardcoded** num repo público, e presumia os containers `n8n-dev`/`postgres-dev` da máquina de quem mantém | `doctor.checks` tipo `command` (com `skip_if: ["docker", "info"]` e `expect_stdout`) |
| `gregioos` | `~/gregioos` é um repo git | presume o repo de config declarativa pessoal; ninguém mais tem esse caminho | `doctor.checks` tipo `path` com `git: true` |
| `dotfiles (stow aplicado)` | `~/code/dotfiles` existe e `~/.config/starship.toml` resolve para dentro dele | mesma coisa: repo pessoal, sentinela pessoal | `doctor.checks` tipo `symlink-inside` |

Junto saíram `stow` das ferramentas obrigatórias (só servia ao dotfiles pessoal —
`wtree` e `herdr` **continuam** exigidos, são para distribuir) e a redação presa
aos aliases de quem mantém nas sugestões de correção (agora: "instale com o
gerenciador de pacotes da sua máquina"). A cicatriz não se perdeu: virou
capacidade configurável, e o exemplo genérico dos três tipos está em
`cli/kb/kb.config.example.json`.

### `doctor.checks` — contratos

- **Config do usuário é entrada não confiável.** `doctor.checks` ausente, não-array,
  entrada sem `label`/`fix`, tipo desconhecido, `argv` que não é array de strings:
  tudo vira ✗ com a explicação, nunca exceção. Diagnóstico que se recusa a rodar por
  causa de uma vírgula é pior do que diagnóstico incompleto.
- **`label` e `fix` são obrigatórios** em todo check. Um ✗ sem sugestão de correção
  é exatamente o que o doctor existe para não ser.
- **`command` roda sem shell** (`spawnSync` com `argv`) — sem interpolação, sem glob,
  sem `&&`. Quem precisa de pipeline põe o `sh -c` explicitamente no próprio `argv`.
- **`expect_stdout`, quando presente, é quem decide** — comando que sempre sai 0
  (`docker exec ... psql -c 'select count(*)'`) não provaria nada pelo exit code.
  `"/regex/flags"` é regex; qualquer outra string é substring.
- **`skip_if` vira `-`, não ✗**: dependência externa desligada (docker parado) não é
  problema da estação, é check que não se aplica agora.
- **Ordem do array = ordem da saída.** O relatório é determinístico, senão o
  contrato read-only ("duas execuções idênticas") cai.

### `kb scaffold` — contratos

- **Só escreve entre os marcadores.** `<!-- kb-scaffold:begin <bloco> v<n> -->` …
  `<!-- kb-scaffold:end <bloco> -->` delimitam a região gerenciada; todo texto fora
  deles é copiado byte a byte. Num CLAUDE.md artesanal os blocos são **anexados ao
  fim** e a migração do texto à mão é do humano — nunca adivinhamos o que apagar.
  Bloco com marcador de início e sem o de fim é ignorado (arquivo mexido à mão).
- **Nunca instala binário.** Bootstrap de estação para no que é filesystem
  (diretórios + CLAUDE.md + `scaffold.profiles` na config); pacote faltando é ✗ do
  `kb doctor` com a sugestão pronta, e quem roda o gerenciador de pacotes (ou o
  `npm i -g`) é o humano.
  A fronteira é o que torna os dois comandos seguros de rodar a qualquer hora.
- **Idempotência é requisito, não gentileza.** Segunda execução não pode tocar em
  mtime nenhum: todo write é precedido de comparação de conteúdo, bloco na mesma
  versão nunca é reescrito (nem se o miolo foi editado à mão) e o retrato do
  `fastfetch` só é capturado quando já se sabe que há algo a escrever — senão o
  uptime da máquina sozinho quebraria a idempotência.
- **`planChanges` (em `cli/kb/src/kb/claude-home.js`) é pura e tem dono único.**
  String entra, string sai — e é a MESMA função que o `kb scaffold` usa para aplicar
  e o `kb doctor` para detectar drift. Doctor com decisão própria mandaria o humano
  rodar um comando que não muda nada. Não duplique a lógica de decisão em nenhum
  dos dois comandos.
- **Bloco sem template não é apagado.** Marcador que este engine não conhece
  (estação que rodou uma versão mais nova) fica como está e vira `orphans` no
  relatório: engine velho não apaga bloco que não sabe recriar.
- **Perfil é escolha explícita e persistida.** `--profiles` presente = decisão do
  humano (inclusive vazio, que zera); ausente = valem os perfis salvos em
  `scaffold.profiles`; sem salvos, só os blocos `all`. Perfil salvo que sumiu do
  manifest continua aparecendo no `--list` — bloco que some sem aviso vira mistério
  na próxima estação.
- **`XDG_CONFIG_HOME`/`KB_CONFIG` são respeitados** para achar o kb config (via
  `cli/kb/src/kb/paths.js`) — NixOS e ambientes de teste dependem disso.

## Armadilhas conhecidas

- `map` considera registrado quem está em `projects` **ou** `vaults` do kb
  config — vaults são repos git em `~/code`, mas registrá-los como project
  seria errado.
- Plugins com scope `project`/`local` não são cobrados em `enabledPlugins`
  global (são habilitados por projeto); o doctor só valida scope `user`.
- **Detecção de NixOS é `/run/current-system`**: `/etc/NIXOS` sumiu no 26.05 e
  quem checava por ele passou a tratar a estação como Linux genérico, dando a dica
  de correção errada. A sugestão de instalação é platform-aware (Nix, gerenciador
  do macOS, gerenciador da distro) e o mesmo vale para o `platforms` dos checks da
  config: numa estação NixOS os tokens que casam são `linux` **e** `nixos`.
- **Presença de binário é procura no PATH, não `--version`.** `wtree`, `herdr` e
  `claude` não têm flag de versão estável: rodar `--version` para decidir presença
  transformava exit code != 0 em ✗ falso — e cada processo disparado é ruído num
  comando read-only.
- **Symlink farm: a prova é o realpath, não o clone.** É por isso que o tipo
  `symlink-inside` existe em `doctor.checks` — repo clonado com o instalador nunca
  rodado deixa tudo "existindo" e nada no lugar, e ninguém percebe.
- O bloco `os-info` é um **retrato**, não um espelho: ele não se refaz a cada
  `kb scaffold`, só quando a versão do bloco sobe. Quem quer o estado de agora roda
  `fastfetch -l none` — o próprio bloco diz isso.

## `kb status` — contratos

- **`warn` vs `info`**: `warn` = "você perde trabalho se ignorar" (uncommitted,
  ahead, stash, branch não mergeada); `info` = contexto (worktree ativo, behind).
  O exit 1 só conta `warn` — quem usa isso em CI/hook não pode ser interrompido
  por informação.
- **Nunca apaga nada.** Diretório órfão em `~/code/worktrees` é REPORTADO com o
  `rm -rf` pronto para copiar; executar por conta própria seria apagar trabalho
  que o git já não consegue recuperar.
- **1 nível de profundidade** em `~/code`: monorepo é um repo, não varremos dentro.
- **Branch principal** é `main` ou `master`, o que existir; sem nenhuma das duas,
  o check de branch não mergeada é pulado (não inventa base de comparação).
- **Dono estranho**: a varredura de `foreignOwner` é rasa (4 níveis) e para no
  primeiro achado — o objetivo é decidir QUAL dica mostrar, não inventariar o
  diretório. Falha de leitura conta como dono estranho (não conseguir listar já
  é o sintoma).
- **Sem repos ≠ sem trabalho**: `status` continua checando os órfãos de
  `<base>/worktrees` mesmo quando não há nenhum repo git na base.

## Testes manuais

```bash
node cli/kb/bin/kb.js scaffold --list  # seletor de perfis/versões, não escreve nada
node cli/kb/bin/kb.js scaffold --dry-run
# estação limpa: HOME isola o CLAUDE.md e KB_CONFIG a config (XDG_CONFIG_HOME do
# shell real vazaria pro teste)
HOME=/tmp/estacao-fake KB_CONFIG=/tmp/estacao-fake/kb.json \
  node cli/kb/bin/kb.js scaffold --profiles backend
node cli/kb/bin/kb.js doctor          # exit 1 é resultado válido se houver ✗ real
node cli/kb/bin/kb.js status --all
node cli/kb/bin/kb.js map
node cli/kb/bin/kb.js rules /tmp/repo-fake --dry-run
echo '{}' | node cli/kb/bin/kb.js guard
```
