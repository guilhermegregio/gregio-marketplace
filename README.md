# gregio-marketplace

> 📄 Movido para o vault: `vault-pessoal/10-projects/gregio-marketplace/architecture/marketplace.md`
> Conhecimento vive no vault; este repo mantém só código + runtime.

Marketplace de plugins do [Claude Code](https://claude.com/claude-code): skills,
commands, agents e hooks curados para desenvolvimento. Instale via `/plugin`
apontando para este repositório.

| Plugin | Descrição |
|---|---|
| [gregio-cc-design-system](packages/gregio-cc-design-system/README.md) | Pipeline de design systems: crawl de site (Playwright) → spec → análise multi-agente → app Astro em `apps/<nome>` → review. Suporta white-label (`--ref`) |
| [gregio-cc-resources](packages/gregio-cc-resources/CLAUDE.md) | Commands de workflow de features (plan → task → finish), hooks de notificação Discord e MCP chrome-devtools |
| [gregio-cc-app-maintenance](packages/gregio-cc-app-maintenance/README.md) | Update de dependências com validação completa (lint/typecheck/test/build) e auditoria de supply-chain, agnóstico ao formato do repo |

Para desenvolver/manter os plugins, comece pelo [CLAUDE.md](CLAUDE.md).
