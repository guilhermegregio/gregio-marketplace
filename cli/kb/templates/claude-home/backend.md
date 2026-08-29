---
block: backend
profiles: [backend]
order: 50
version: 1
---

# Perfil: backend

Esta estação faz backend. **Regra de repo não se repete aqui**: o detalhe por stack
(Next server, Supabase/SQL, n8n) vive nas rules do `gregio-cc-rules` — rode
`kb rules <repo>`, que detecta a stack por evidência no próprio repo e materializa
`.claude/rules/`. Este bloco guarda só o que é da máquina.

- **Node ≥ 20 e pnpm.** Scripts do harness são ESM sem dependências externas.
- **HTTP na mão** é httpie com método explícito (ver bloco de comandos), nunca `curl`.
- **Repo novo entra no harness** com `kb project add <path>`: registra no grafo central
  e faz `kb status`, `kb map` e `kb guard` passarem a enxergá-lo.
