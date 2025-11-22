# Plan to brainstorm

Em todas as suas respostas, evite elogios desnecessários, engaje-se criticamente com minhas ideias, questione minhas suposições, identifique meus vieses e ofereça contrapontos quando relevante. Não fuja da discordância e certifique-se de que quaisquer argumentos que você tenha sejam fundamentados em razão e evidências. Ao redigir sua resposta, certifique-se de incluir as seguintes informações:
1. Uma visão neutra e imparcial da solicitação, sem o filtro do seu desejo de ser um assistente útil e positivo.
2. Uma visão de advogado do diabo, apontando quaisquer contrapontos lógicos ou aspectos que eu tenha negligenciado.
3. Uma visão positiva e encorajadora da solicitação.

## Run the following command

eza . --tree --git-ignore

## Read the following files
> Read the files below and nothing else.

README.md
package.json
src/affiliates/actions/affiliateActions.ts
src/affiliates/actions/trackingActions.ts
src/affiliates/domain/models.ts
src/affiliates/domain/services.ts
src/affiliates/hooks/useAffiliateMetrics.ts
src/affiliates/hooks/useAffiliateTracking.ts
src/affiliates/index.ts
src/affiliates/infra/attributionRepository.ts
src/affiliates/infra/commissionProcessor.ts
src/affiliates/infra/commissionRepository.ts
src/affiliates/infra/database.types.ts
src/affiliates/infra/repository.ts
src/affiliates/infra/stripe.ts
src/affiliates/infra/tracking.ts
src/affiliates/jobs/commissionProcessor.ts
src/affiliates/ui/components/AffiliateCodeInput.tsx
src/affiliates/ui/components/AffiliateDashboard.tsx
src/affiliates/ui/components/AffiliateRegistrationForm.tsx
src/affiliates/ui/components/ContentTemplates.tsx
src/affiliates/ui/components/LinkGenerator.tsx
src/affiliates/ui/components/MaterialsLibrary.tsx
src/affiliates/ui/components/ResourceCenter.tsx
src/affiliates/ui/components/admin/AffiliateManagementDashboard.tsx
src/affiliates/ui/components/admin/AffiliateMetrics.tsx
src/affiliates/ui/components/admin/AffiliatesList.tsx
src/affiliates/ui/components/admin/CommissionsManagement.tsx
src/affiliates/ui/components/admin/OverviewTab.tsx
src/affiliates/ui/components/admin/PaymentsBatch.tsx
src/affiliates/utils/validators.ts
src/app/affiliate/dashboard/page.tsx
src/app/affiliate/payment/page.tsx
src/app/affiliate/payment/success/page.tsx
src/app/affiliate/register/page.tsx
src/app/api/admin/affiliates/[id]/status/route.ts
src/app/api/admin/affiliates/metrics/route.ts
src/app/api/admin/affiliates/route.ts
src/app/api/admin/affiliates/stats/route.ts
src/app/api/admin/commissions/approve/route.ts
src/app/api/admin/commissions/pending/route.ts
src/app/api/admin/commissions/process/route.ts
src/app/api/admin/commissions/reject/route.ts
src/app/api/admin/commissions/route.ts
src/app/api/admin/payments/batches/route.ts
src/app/api/admin/payments/download/[batchId]/route.ts
src/app/api/admin/payments/generate-batch/route.ts
src/app/api/admin/payments/mark-processed/[batchId]/route.ts
src/app/api/admin/payments/summary/route.ts
src/app/api/affiliate/checkout/route.ts
src/app/api/affiliates/[id]/commissions/route.ts
src/app/api/affiliates/[id]/metrics/route.ts
src/app/api/affiliates/validate/[code]/route.ts
src/app/api/checkout/route.ts
src/app/api/checkout/strength-runners/route.ts
src/app/api/checkout/webhook/route.ts
src/app/api/stripe/affiliate-webhook/route.ts
src/app/api/webhooks/affiliate/route.ts
src/app/api/webhooks/checkout/route.ts
src/app/home/ButtonPayment.tsx
src/app/home/page.tsx
src/app/management/affiliates/page.tsx
src/middleware.ts
src/shared/infra/auth0.ts
src/shared/infra/database.types.ts
src/shared/ui/components/Tabs.tsx
