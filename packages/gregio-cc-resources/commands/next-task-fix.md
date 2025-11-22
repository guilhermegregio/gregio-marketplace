---
description: Fix implementation issues for the features included in the current plan.
---

# Implementation

think deeply, vamos continuar as implementações, se contextualize com os arquivos @specs/current.md, analise tudo que precisa antes de iniciar, sega as intruções e fluxos, validações etc, aguarde quando necessário validação manual.

<fix>
  $ARGUMENTS
</fix>

## Fluxo de Validação
**IMPORTANTE**: Durante validação e ajustes finos, seguir este fluxo:

1. Não fazer commit a cada alteração
   - Aguardar validação manual completa do fluxo
   - Agrupar correções relacionadas em um único commit

2. Executar apenas lint durante desenvolvimento
   - `pnpm lint` para validar código rapidamente
   - Build completo apenas após validação aprovada

3. Commits agrupados
   - Fazer commit após conjunto de correções validadas
   - Mensagens descritivas com todas as alterações incluídas

4. Atualizar este documento
   - Registrar todas as correções e ajustes realizados
   - Manter histórico de problemas encontrados e soluções em @specs/current.md
