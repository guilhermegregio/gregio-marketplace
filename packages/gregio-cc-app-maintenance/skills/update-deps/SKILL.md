---
name: update-deps
description: "Atualiza dependências de qualquer app Node.js (Nx monorepo, pnpm workspace, ou app pnpm simples) com validação completa — lint, typecheck, testes, build — e auto-fix entre tentativas. Faz rollback seguro se a validação não passar após 3 tentativas. Use SEMPRE que o usuário pedir para 'atualizar deps', 'update dependencies', 'bump packages', 'rodar ncu', 'dependências desatualizadas', 'outdated packages', 'upgrade pacotes', 'atualizar libs', mesmo que não mencione a skill explicitamente. Detecta o tipo de repo automaticamente — não pergunte ao usuário se é Nx/workspace/simple, descubra rodando o detect-repo-type.js."
argument-hint: [check | minor | all | <filtro>] [--no-visual]
---

## Your task

Você é um agente de manutenção responsável por atualizar dependências com segurança. O risco é alto: uma atualização mal feita quebra o build, CI, ou pior, um deploy em produção. Por isso o fluxo é **detectar → descobrir → aplicar → validar (4 frentes) → corrigir → revalidar → só commitar se tudo passar**.

<arguments>
$ARGUMENTS
</arguments>

Formato: `[modo] [--no-visual]`

- `check` → dry-run: mostra o que seria atualizado e encerra sem modificar nada
- `minor` → restringe a minor/patch (sem major bumps)
- `all` (default) → fluxo completo
- `<filtro>` → string literal passada ao `--filter` do ncu (ex: `next`, `react`, `@nx/*`)
- `--no-visual` → pula a validação visual com chrome-devtools mesmo se for aplicável

---

## Phase 0 — Detect

Descobre o tipo do repo e carrega o reference correspondente. Isto é o que torna a skill agnóstica.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-repo-type.js" .
```

O output é JSON com `type: "nx" | "pnpm-workspace" | "pnpm-simple" | "unknown"`. Ações:

- **nx** → leia `references/nx.md`
- **pnpm-workspace** → leia `references/pnpm-workspace.md`
- **pnpm-simple** → leia `references/pnpm-simple.md`
- **unknown** → pare e avise o usuário que não encontrou `package.json` nem `nx.json` nem `pnpm-workspace.yaml`. Pergunte onde está a raiz do projeto.

Guarde os comandos do reference em memória — você vai usá-los em todas as Phases seguintes. Se o detect reportar `nxVersionMismatch`, `hasOverrides`, ou `hasPatches`, anote para mencionar em Phase 2.

## Phase 1 — Pre-flight

1. `git status --porcelain` — se houver mudanças não commitadas, avise o usuário e pergunte via AskUserQuestion: "continuar mesmo assim" ou "cancelar". Um update de deps misturado com mudanças não relacionadas vira um commit ilegível e difícil de reverter.
2. `git rev-parse HEAD` — guarde esse hash. É sua rede de segurança caso precise de rollback.

## Phase 2 — Discovery

Monte os flags do `npm-check-updates` com base no tipo do repo e no argumento:

**Base flags por tipo:**
- `nx` ou `pnpm-workspace` → `--workspaces --root`
- `pnpm-simple` → (sem flags de workspace)

**Modificadores por argumento:**
- `minor` → adicionar `--target minor`
- filtro (qualquer string que não seja `check`/`minor`/`all`/vazio) → adicionar `--filter "<filtro>"`

Rode:
```bash
pnpx npm-check-updates --format group <flags>
```

Apresente um resumo agrupado: **Major** (breaking), **Minor** (features novas), **Patch** (bugfix). Destaque:

- **Pacotes Nx** (`nx`, `@nx/*`) — devem estar TODOS na mesma versão. Se o detect reportou `nxVersionMismatch`, mostre-o.
- **`pnpm.overrides`** — se `hasOverrides` é `true`, liste os pacotes. Overrides não são atualizados automaticamente pelo ncu; o usuário pode precisar sincronizar manualmente.
- **`pnpm.patchedDependencies`** — se `hasPatches` é `true`, liste os pacotes. Um patch pode não aplicar limpo na versão nova; avise.
- **`workspace:*`** — ncu preserva esse protocolo, mas confirme no diff.

**Se modo `check`:** pare aqui. Imprima "Modo dry-run — nenhuma alteração aplicada." e encerre.

## Phase 3 — Apply

1. **AskUserQuestion** antes de modificar qualquer coisa:
   - Opção 1: "Aplicar todas as atualizações"
   - Opção 2: "Cancelar"
   - Se houver majors, inclua um aviso: "atenção: X major bumps podem quebrar imports/tipos".

2. Se confirmado, aplique:
   ```bash
   pnpx npm-check-updates -u <mesmos flags da Phase 2>
   ```

3. Instale:
   ```bash
   pnpm install
   ```

4. Mostre o diff:
   ```bash
   git diff --stat
   ```

## Phase 4 — Validate (lint + typecheck + test + build)

Os comandos exatos vêm do reference file carregado em Phase 0. A ordem importa: lint é quase-instantâneo, typecheck é rápido, test é médio, build é o mais lento. Rodando nessa ordem você pega o erro mais barato primeiro e evita esperar 3 minutos de build para descobrir um import quebrado.

### Tentativa 1

Rode as 4 validações. Use o comando consolidado quando o reference oferecer um (`nx run-many -t lint,typecheck,test,build --parallel=3` no Nx, por exemplo), senão rode em sequência.

Se tudo passar → pule para **Phase 5**.

### Tentativas 2 e 3 (se 1 falhou)

**Analise o output** — não chute. Erros típicos depois de bump:

- **Type errors**: tipos renomeados, assinaturas mudaram, generics novos. Lê a mensagem, olha a função/tipo no código, ajusta.
- **Imports quebrados**: export renomeado (`import { foo } from 'pkg'` vira `import { newFoo } from 'pkg'`), default virou named, ou subpath mudou. Grep pelo nome antigo, atualiza.
- **API deprecada/removida**: biblioteca removeu uma função. Consulta o CHANGELOG (geralmente em `node_modules/<pkg>/CHANGELOG.md`) e aplica o migration path.
- **Incompatibilidade entre libs**: lib A nova exige lib B em versão que não bate. Ajusta B também, ou volta A.
- **Config**: novo major pode exigir mudança no `tsconfig.json`, `eslint.config.*`, `vite.config.*`, etc.

Aplique as correções via Edit/Write e **rode as 4 validações de novo**. Não pule direto para build — mantenha a ordem lint → typecheck → test → build.

### Se falhar na 3ª tentativa

AskUserQuestion:
- Opção 1: "Manter mudanças e corrigir manualmente" (skill encerra sem commit)
- Opção 2: "Rollback completo"

Se rollback:
```bash
git checkout -- .
pnpm install
git status
```
Confirme no `git status` que a árvore voltou ao limpo.

## Phase 5 — Visual check (opcional)

Só aplicável se o app tem UI e o MCP `chrome-devtools` está disponível.

1. Checa:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/has-dev-server.js" .
   ```
   Se `hasDevServer: false` ou o usuário passou `--no-visual`, pule para Phase 6.

2. Siga os passos de `references/visual-validation.md`. Resumo: sobe o dev server em background, navega pela home, lê console, tira screenshot, derruba o server. Erros no console (não warnings) falham o fluxo e te mandam para Phase 4 tentativa 2/3.

## Phase 6 — Commit

Só chegue aqui se Phase 4 passou. Nunca use `--no-verify`.

1. Stage:
   ```bash
   git add -A
   ```

2. Commit com mensagem descritiva (não só "update deps"):
   ```bash
   git commit -m "chore(deps): update dependencies

   - N major bumps: <lista sucinta>
   - M minor/patch: <resumo>"
   ```

3. Resumo final para o usuário:
   - Pacotes atualizados (por grupo)
   - Arquivos tocados (incluindo auto-fixes, se houve)
   - Hash do commit
   - Link ou caminho do screenshot, se Phase 5 rodou

4. Notifique:
   ```bash
   notify-beep "Dependências atualizadas com sucesso" 2>/dev/null || true
   ```

---

## Regras

- **Nunca** deixe pacotes `nx` / `@nx/*` em versões diferentes entre si — quebra o runner do Nx de formas sutis.
- **Nunca** substitua `workspace:*` por versão fixa. É o protocolo que garante resolução local no monorepo.
- **Nunca** use `--no-verify`. Se um hook falha, é sinal; investigue.
- **Nunca** force-push nem `git reset --hard` como atalho.
- No rollback, sempre rode `pnpm install` depois do `git checkout --` para sincronizar `node_modules` com o lockfile restaurado.
- Respeite a indentação dos `package.json` — o ncu mantém, mas double-check se editou manualmente.
- Se detectar `pnpm.overrides` ou `pnpm.patchedDependencies`, **nunca** silencie sem avisar. Os patches podem não aplicar na versão nova.
