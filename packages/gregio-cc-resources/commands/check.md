# Check: Lint, Build e Fix

Execute as seguintes tarefas usando um sub-agent especializado para economizar tokens da sessão principal.

## Uso

```bash
/check          # Completo: lint + build + correções automáticas
/check lint     # Apenas: lint + correções automáticas (rápido para dev)
/check build    # Apenas: build (sem lint)
```

## Tarefas

**Detecte o argumento passado e execute apenas as tarefas correspondentes:**

### Sem argumento ou qualquer outro argumento (Completo)
1. **Lint**: Execute `pnpm lint` e capture todos os erros e warnings
2. **Build**: Execute `pnpm build:test` e capture todos os erros de compilação
3. **Análise**: Identifique quais erros podem ser corrigidos automaticamente
4. **Correção**: Corrija automaticamente os erros quando possível:
   - Erros de formatação/estilo
   - Imports não utilizados
   - Tipos faltantes simples
   - Outras correções de lint automáticas
5. **Re-validação**: Após correções, re-execute `pnpm lint` e `pnpm build:test`
6. **Relatório**: Retorne um relatório resumido

### Argumento: "lint"
1. **Lint**: Execute `pnpm lint` e capture todos os erros e warnings
2. **Análise**: Identifique quais erros podem ser corrigidos automaticamente
3. **Correção**: Corrija automaticamente os erros quando possível
4. **Re-validação**: Após correções, re-execute `pnpm lint`
5. **Relatório**: Retorne relatório resumido (apenas seção de Lint)

### Argumento: "build"
1. **Build**: Execute `pnpm build:test` e capture todos os erros de compilação
2. **Relatório**: Retorne relatório resumido (apenas seção de Build)

## Formato do Relatório

**Adapte o relatório baseado no que foi executado:**

### Para /check (completo) ou /check sem argumento:
```
## ✅ Status Final: [SUCESSO/WARNINGS/ERROS]

### Lint
- Status: [✅/⚠️/❌]
- Erros corrigidos: X
- Warnings restantes: Y

### Build
- Status: [✅/❌]
- Erros corrigidos: X
- Erros manuais: Y

### Arquivos Modificados
- arquivo1.ts
- arquivo2.tsx

### ⚠️ Requer Atenção Manual
- [ ] Erro X em arquivo.ts:linha
- [ ] Erro Y em arquivo2.tsx:linha
```

### Para /check lint:
```
## ✅ Status Final: [SUCESSO/WARNINGS/ERROS]

### Lint
- Status: [✅/⚠️/❌]
- Erros corrigidos: X
- Warnings restantes: Y

### Arquivos Modificados
- arquivo1.ts
- arquivo2.tsx

### ⚠️ Requer Atenção Manual
- [ ] Erro X em arquivo.ts:linha
```

### Para /check build:
```
## ✅ Status Final: [SUCESSO/ERROS]

### Build
- Status: [✅/❌]
- Erros: X

### ⚠️ Requer Atenção Manual
- [ ] Erro X em arquivo.ts:linha
```

## Execução

**IMPORTANTE**: Use o Task tool com `subagent_type="general-purpose"` para executar todo esse processo, economizando tokens da sessão principal.

O sub-agent deve:
- Ter autonomia para corrigir erros simples
- Retornar APENAS o relatório resumido (não mostrar todo o output dos comandos)
- Focar em correções seguras e automáticas
- Listar claramente o que precisa de atenção manual
- JAMAIS rodar tsc --noEmit pois não é necessário check types apenas rodar o lint e build são suficientes
- Permitido apenas rodar o `pnpm lint` e `pnpm build:test` pois já tem toda a configuração para validar
