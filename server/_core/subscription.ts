// Decisão PURA de acesso por assinatura. Uma org só usa o sistema se estiver
// com pagamento em dia (Stripe "active") ou em período de teste ("trialing").
// Qualquer outro estado (none, past_due, canceled, unpaid, undefined) NEGA —
// fail-closed: dúvida sobre a assinatura fecha a porta, não abre.
//
// Estava duplicada em dois pontos do trpc.ts e faltava por completo no caminho
// HTTP do rastreio (/api/track), que assim virava um bypass do paywall: uma
// frota inadimplente continuava gravando GPS. Centralizar aqui garante a MESMA
// regra em todas as bordas.
export function assinaturaAtiva(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

// Override MANUAL do super-admin, independente do Stripe. O webhook NUNCA escreve
// nele, então o bloqueio manual não é desfeito por um evento do Stripe.
export type AccessOverride = "active" | "blocked" | null | undefined;

export interface OrgAcesso {
  subscriptionStatus?: string | null;
  accessOverride?: AccessOverride;
}

// Decisão FINAL de acesso (o que TODOS os gates devem usar). Ordem:
//   1. override "blocked" → NEGA, mesmo com Stripe ativo (kill switch do admin).
//   2. override "active"  → CONCEDE, sem depender do Stripe (cortesia/pgto por fora).
//   3. sem override       → segue a assinatura do Stripe (fail-closed).
export function temAcesso(org: OrgAcesso | null | undefined): boolean {
  if (org?.accessOverride === "blocked") return false;
  if (org?.accessOverride === "active") return true;
  return assinaturaAtiva(org?.subscriptionStatus);
}
