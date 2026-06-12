# gregio-cc-design-system — guia do mantenedor

Pipeline multi-agente que transforma um site em um design system como app Astro.
O README cobre o uso; este arquivo cobre os contratos e as regras que não podem
regredir num refactor. Leia também o `CLAUDE.md` da raiz (convenções de skills).

## Arquitetura

```
extract → brainstorm → analyze → build → review
```

- **1 skill orquestradora** (`skills/ds-create`) + **5 skills de fase** — todas
  finas. O procedimento canônico de cada fase vive em
  `references/pipeline/<fase>.md`. **Regra DRY**: mudança de comportamento de
  fase vai no pipeline doc; o SKILL.md só muda se args/triggering mudarem.
- **7 agentes** em `agents/`: 5 analistas read-only+Write de output
  (`ds-token-analyst`, `ds-typography-analyst`, `ds-component-analyst`,
  `ds-motion-analyst`, `ds-layout-analyst`), 1 executor genérico de task de
  build (`ds-builder`, invocado N vezes em waves) e 1 revisor com poder de
  correção (`ds-reviewer`). Prompt de dispatch = só paths; método no agente.
- **Crawler** (`scripts/crawl-site.js`): Playwright-only, pinado em
  `playwright@1.58.2`, sequencial num único browser **e único context**
  (cookies persistem — é o que faz `--click` de gates funcionar).

## Contratos (onde está a verdade)

| Contrato | Arquivo canônico |
|---|---|
| Layout do cache + workspace + re-crawl | `references/cache-layout.md` |
| Manifest v2 (provenance, componentsRef) | `references/manifest-schema.md` |
| Baseline de DS mínimo | `references/ds-minimum-baseline.md` |
| Regras de showcase (extracted × designed) | `references/showcase-rules.md` |
| Formato de task de build | `templates/shared/build-task.md.tmpl` |
| Spec (estado do pipeline no frontmatter) | `templates/shared/ds-spec.md.tmpl` |

Mudou um contrato → atualize o arquivo canônico PRIMEIRO e depois os
consumidores (pipeline docs/agentes citam esses paths).

Pontos-chave dos contratos:
- Cache **global** em `~/.ds-cache/<site-slug>/` (crawl compartilhado entre
  projetos) + **workspace por app** em `<site>/apps/<app-name>/` (ds-spec.md +
  analysis/ — estado de UMA run).
- Frontmatter do `ds-spec.md` é o estado do pipeline: `cache_dir` (absoluto),
  `app_dir`, `components_ref`, `status: draft|approved`. Fases seguintes só
  rodam com `approved`.
- Manifest v2: todo componente tem `provenance: extracted|designed`; white-label
  adiciona `refComponent` por componente e `meta.componentsRef`.

## White-label (`--ref=<ds-app>`)

O inventário e a **API de Props** vêm de um DS de referência (ex.
`apps/ds-nxt` no ds-agent); o visual vem do site extraído. Paridade de Props é
contrato: **diff vazio**, verificado pelo reviewer. Efeito colateral conhecido e
aceito: alinhar um componente existente à API da ref REMOVE props extras que a
ref não tem (Button perdeu `ariaLabel`, Input perdeu `disabled` no ds-cury v2).
Se isso virar problema, a mudança é flexibilizar a regra para "superset
permitido" — decisão do usuário, não tomar unilateralmente.

## Regras que não podem regredir

1. **Isolamento por run**: escopo = {url, app-name, --ref}. Runs do mesmo site
   não se enxergam (workspaces separados); proibido ler outros `apps/*` exceto
   a ref e o scan de portas. Motivação: criar DSs em paralelo e comparar.
2. **Re-crawl automático** (`broadenedReasons` no crawl-site.js): opções mais
   amplas que as do cache (max-pages/depth maiores, clicks/include/exclude
   diferentes, sections/mobile ligados) → re-crawl com log do motivo. Ao
   adicionar capacidade nova ao crawler, **adicione um motivo de re-crawl para
   caches antigos** (padrão: `if (!Array.isArray(crawl.icons))` quando ícones
   foram introduzidos).
3. **Re-crawl e `--force` preservam `apps/`** (`clearCrawlArtifacts` remove só
   crawl.json/pages/assets).
4. **Builders nunca tocam arquivo compartilhado**: cada task declara seus
   arquivos exatos; `index.css` é montado pelo orquestrador nos gates entre
   waves; o manifest tem dono único (task de docs).
5. **Favicons são busca explícita** (`captureIcons`): headless browsers não
   requisitam favicon/apple-touch/webmanifest — o listener de response nunca os
   vê. Não "simplificar" removendo isso.

## Armadilhas (custaram debug real)

- **NixOS 26.05**: `/etc/NIXOS` não existe — detecção via `/run/current-system`
  (`setupNixEnv`). O executablePath do Chromium vem de glob no
  `playwright-driver.browsers` do nix; sem ele o playwright procura
  headless-shell de revisão incompatível.
- **CSS cross-origin**: `document.styleSheets[].cssRules` lança em sheets de
  CDN → `rootVars` viria vazio. Fallback: extrair nomes `--*` do CSS baixado
  (Node) e resolver via `getComputedStyle` no browser.
- **Gates de região** (cury.net SP/RJ): cobrem TODAS as páginas; o clique
  dispara navegação (destrói o execution context — por isso o retry no
  collectPageData) e o cookie só persiste porque o context é compartilhado.
  `--click` clica no **primeiro match visível** (o mesmo seletor casa itens
  ocultos de dropdown).
- **networkidle** nunca dispara em sites com polling → fallback automático para
  `waitUntil: load`.

## Como testar

- **Site de validação**: `https://cury.net/` — gate de região atravessado com
  `--click='#adopt-accept-all-button' --click='[data-change-state="SP"]'`.
- **Crawler isolado**: `node --check scripts/crawl-site.js` e depois
  `npx --yes --package=playwright@1.58.2 -- node scripts/crawl-site.js https://cury.net/ --max-pages=2 --out=/tmp/ds-test <clicks>`;
  conferir computed.json populado, screenshots, ícones, re-run → `cached: true`.
- **E2E**: no `~/code/ds-agent`, `/ds-create https://cury.net/ <nome> --ref=apps/ds-nxt`;
  build verde via `pnpm exec nx build <nome>`, manifest limpo via
  `node scripts/validate-manifest.js apps/<nome>/design-system.manifest.json`.
- **Evals**: `evals/evals.json` tem os prompts + assertions para o loop do
  skill-creator (run with-skill vs baseline + eval-viewer).

## Versionamento

Bump em **dois lugares**: `.claude-plugin/plugin.json` do pacote e a entrada em
`.claude-plugin/marketplace.json` da raiz.
