// Qual ação de cobrança oferecer ao usuário. Função PURA — testada em
// server/billingAction.test.ts.
//
// O caso que motivou isto: cliente com cartão vencido (past_due) via só
// "Assinar", que abre um checkout NOVO — ele acabaria com DUAS assinaturas
// em vez de corrigir a existente. Nesse estado o certo é mandar pro portal.

export type AcaoCobranca = "assinar" | "gerenciar" | "indisponivel";

export interface EstadoCobranca {
  status: string;
  configured: boolean;
  hasBilling: boolean;
}

// Estados em que o problema é a FORMA DE PAGAMENTO, não a falta de assinatura.
const PROBLEMA_DE_PAGAMENTO = ["past_due", "unpaid"];

export function acaoPaywall(e: EstadoCobranca): AcaoCobranca {
  if (!e.configured) return "indisponivel";
  // Só faz sentido mandar ao portal se a empresa já é cliente no Stripe.
  if (e.hasBilling && PROBLEMA_DE_PAGAMENTO.includes(e.status)) {
    return "gerenciar";
  }
  return "assinar";
}

// O portal (trocar cartão, cancelar, ver faturas) fica disponível sempre que a
// empresa já for cliente no Stripe — inclusive como ação secundária no paywall.
export function podeAbrirPortal(e: EstadoCobranca): boolean {
  return e.configured && e.hasBilling;
}
