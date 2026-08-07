---
rule: next-server
stacks: [next]
version: 1
---

# Next — servidor (RSC, server actions, data-access)

## Server action recebe o escopo pela rota

Server action é chamável diretamente pelo cliente — o gate e o alvo vivem **dentro
dela**, não na UI que a esconde.

```ts
// ✓ o produto vem da rota; o gate é reavaliado aqui
export async function restartPlan(modalitySlug: string) {
  const ctx = await requireActiveStudent();
  if (!canRestart(ctx, modalitySlug)) return { success: false, error: "…" };
  const modality = ctx.modalities.find((m) => m.active && m.slug === modalitySlug);
  if (!modality) return { success: false, error: "…" };
  await supabase.from("x").update({ … })
    .eq("student_id", ctx.student.id)
    .eq("modality", modality.anamnesis_modality);   // ← sem isto, apaga o vizinho
}
```

## `revalidatePath` cobre as rotas realmente afetadas

Inclua a rota dinâmica do item alterado, não só a lista. Rota esquecida = usuário vê
dado velho e acha que não salvou.

## Erro de leitura não vira estado vazio

`if (error) throw` — engolir o erro renderiza "nenhum plano ativo", que é
indistinguível de "não tem plano". O error boundary existe para isso.

## Fronteira de package

Package compartilhado (`packages/*-core`) **não importa `next/*`**. Componente que
precisa de `next/link`/`next/navigation` vive no app; o package expõe o domínio e
recebe callbacks/`href` como props.

## Um arquivo, uma responsabilidade de camada

`infra/` faz data-access (queries scoped por tenant), `domain/` é puro e testável,
`ui/` compõe. Regra de bolso: se dá para testar sem banco, é domain — e então **tem
teste**.
