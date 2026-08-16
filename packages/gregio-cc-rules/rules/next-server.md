---
rule: next-server
stacks: [next]
version: 2
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

## `select` sem filtro mente a partir da linha 1000

O PostgREST aplica `max-rows` (1000 no Supabase) e **não sinaliza o corte**: sem erro,
sem flag, sem `count`. Varrer uma tabela para cruzar em memória funciona até ela passar
do limite — aí o `Set` vem pela metade e o registro que caiu fora some da tela como se
não existisse.

```ts
// ✗ 2631 assinaturas, 1000 voltam: quem estiver depois do corte "não tem assinatura"
const { data: subs } = await supabase.from("subscriptions")
  .select("user_id").in("status", ["active", "trialing", "free"]);
const ativos = new Set(subs.map((s) => s.user_id));
return vinculos.filter((v) => ativos.has(v.user_id));

// ✓ pergunte "quais DESTES", não "todos" — em lotes, porque .in() vai na URL
const ativos = await fetchActiveSubscriberIds(supabase, vinculos.map((v) => v.user_id));
```

O sintoma é cruel: aparece só para as linhas **novas** (fim da tabela), meses depois do
código entrar, e o dado no banco está perfeito. Regra prática: todo `select` de leitura
tem `.eq()`/`.in()` que o escope, ou `.range()` explícito assumindo o teto. Cruzamento
em memória de tabela inteira é o cheiro — o banco faz esse join melhor.

Se a lista de ids for grande, mande em chunks (~100): `.in()` entra na querystring e a
URL tem limite de tamanho.

## Fronteira de package

Package compartilhado (`packages/*-core`) **não importa `next/*`**. Componente que
precisa de `next/link`/`next/navigation` vive no app; o package expõe o domínio e
recebe callbacks/`href` como props.

## Um arquivo, uma responsabilidade de camada

`infra/` faz data-access (queries scoped por tenant), `domain/` é puro e testável,
`ui/` compõe. Regra de bolso: se dá para testar sem banco, é domain — e então **tem
teste**.
