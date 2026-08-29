---
block: core
profiles: [all]
order: 20
version: 1
---

# COMANDOS

Sempre prefira:

- **Busca em texto:** `rg` — respeita o ignore do repo e é o que eu leio no histórico.
- **Busca de arquivos:** `fd`.
- **JSON:** `jq`. **YAML:** `yq`.
- **HTTP:** httpie (`http` / `https`). O `http` assume `http://`, então passe a URL
  completa (`http "https://google.com"`) ou use `https google.com`. Seja **sempre
  explícito no método** — `https GET google.com`, nunca `https google.com`.

# COMANDOS PROIBIDOS (nunca usar)

`find`, `grep`, `curl`

# ARQUIVOS TEMPORÁRIOS

Temporários vão em `~/code/.scratchpad`, **nunca em `/tmp`**: o `/tmp` do agente não é
acessível a mim, então o que você escreve lá eu não consigo abrir. O conteúdo do
scratchpad é efêmero — qualquer arquivo ali pode ser apagado a qualquer momento.

# BASE DE CONHECIMENTO & PLANOS (kb)

**Fronteira:** repo = código + runtime; **vault = conhecimento** (docs, ADRs,
arquitetura, planos, learnings, research). Nunca crie doc ou plano solto num repo — vai
pro vault via `kb`.

- **skill `kb`** — pedido de consultar/registrar conhecimento, ideia, projeto, plano,
  ADR, learning ou research; "o que eu sei sobre X", "onde está a decisão sobre Y",
  "salva essa ideia/artigo". O protocolo de leitura é carregamento cirúrgico (router
  `00-meta/_index.md` → índices → folhas), nunca `ls -R` do vault.
- **skill `devflow`** — ciclo de plano cross-project via `kb dev start|check|run|done`:
  **spec → protótipo ⛔ → behaviors ⛔🧊 → código → review → finish**. Os ⛔ são gates
  humanos; o 🧊 é `kb dev freeze` — contrato congelado **não se edita para o código
  passar**: cenário quebrando significa que o código está errado.
- **skill `graphify`** — qualquer input vira grafo de conhecimento. Quando eu digitar
  `/graphify`, invoque a skill antes de qualquer outra coisa.

# PRIMEIRO SOCORRO

Faltou diretório do workspace, ferramenta do contrato, ou um bloco deste arquivo está
velho? Rode **`kb doctor`**: ele lista ✓/✗ com o comando de correção pronto para copiar,
e nunca conserta nada sozinho. O que ele apontar como workspace ou bloco desatualizado se
resolve com `kb scaffold`.
