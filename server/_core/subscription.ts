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
