---
rule: astro-ds
stacks: [astro]
version: 1
---

# Astro — protótipos e design system

## O protótipo espelha as rotas de produção

Caminhos relativos idênticos aos do app real (só o prefixo muda). O handoff vira
tradução direta; divergir aqui custa retrabalho na implementação.

## Tokens do DS, nunca cor literal

`var(--zone-base)`, `var(--brand-primary)`. Se o token não existe no CSS que a página
carrega, ele resolve para nada e o elemento fica **sem cor** — silenciosamente. Ao
reusar um componente do DS num contexto novo, confirme que o arquivo de tokens está
carregado (ou redeclare os estilos no CSS do protótipo).

## Zero dependência externa

Sem CDN, sem fonte remota, sem script de terceiro. Protótipo tem que abrir offline e
build determinístico.

## Mock com forma de produção

O dado do protótipo tem o mesmo shape do payload real (mesmos nomes de campo). Assim o
componente migra sem reescrita e o mock vira fixture de teste.

## Interação sem framework

`data-*` + um script pequeno resolve toggle, tab e sheet. Protótipo não é lugar de
importar runtime de UI.
