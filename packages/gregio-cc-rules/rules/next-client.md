---
rule: next-client
stacks: [next]
version: 1
---

# Next — cliente

## `"use client"` é exceção, não default

Só quando há estado, efeito ou handler. Server component por padrão: menos JS, dado
mais fresco.

## Cor de ação × cor de informação

`primary` da marca é **ação** (CTA, submit). Acento é **informação** (tipo, categoria,
status). Trocar o CTA para a cor do acento quebra a leitura do app — em white-label,
cada marca tem seu `primary`, e o usuário aprende que "o botão é aquela cor".

## Feedback de erro é do app, não do package

Componente de package recebe `onError`/`onSave`/`onNavigate`; o app injeta `toast`,
`router.push`, server action. Isso mantém o package testável e reusável entre apps.

## Rota é parâmetro, não constante

Navegação dentro de um componente reusável (`/plan/preferences/...`) some assim que
aparece a segunda instância (`/plan/<produto>/preferences/...`). Receba `basePath`.

## Estado derivado > estado duplicado

Se dá para calcular do que já veio do servidor, calcule. `useState` espelhando prop é
fonte garantida de dessincronia.
