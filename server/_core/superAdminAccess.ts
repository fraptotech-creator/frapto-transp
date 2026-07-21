// Liberação/bloqueio MANUAL de acesso pelo dono da plataforma — para quem paga
// por fora do Stripe (PIX, transferência, etc.).
//
// Decisão PURA (entra o estado da empresa, sai o que gravar). O efeito no banco
// fica na borda, no router.
//
// INVARIANTE que protege o negócio: NÃO deixa mexer à mão em empresa que tem
// assinatura no Stripe. Dois motivos concretos:
//   1. O webhook (applySubscription em _core/stripe.ts) reescreve o
//      subscriptionStatus no próximo evento — a liberação manual seria desfeita
//      sozinha, sem aviso, e pareceria "bug do sistema".
//   2. Bloquear à mão quem paga por Stripe TIRA o acesso mas NÃO cancela a
//      cobrança — o cliente continuaria pagando sem poder usar.
// Nesses casos o certo é resolver no painel do Stripe. Erro visível > efeito
// silencioso e errado.

export type AcaoAcesso = "liberar" | "bloquear";

export interface OrgParaAcesso {
  stripeSubscriptionId?: string | null;
}

export type PatchAcesso = {
  subscriptionStatus: "active" | "canceled";
  planName: string | null;
};

export type DecisaoAcesso =
  | { ok: true; patch: PatchAcesso }
  | { ok: false; motivo: string };

// Marca o que foi liberado na mão, para diferenciar de assinante do Stripe.
export const PLANO_MANUAL = "Manual (liberado pelo admin)";

export function decidirMudancaAcesso(
  org: OrgParaAcesso | null | undefined,
  acao: AcaoAcesso
): DecisaoAcesso {
  if (!org) {
    return { ok: false, motivo: "Empresa não encontrada." };
  }
  if (org.stripeSubscriptionId) {
    return {
      ok: false,
      motivo:
        "Esta empresa assina pelo Stripe. Libere ou cancele pelo painel do " +
        "Stripe: mudar aqui seria desfeito pelo webhook, e bloquear aqui " +
        "tiraria o acesso sem parar a cobrança.",
    };
  }
  if (acao === "liberar") {
    return {
      ok: true,
      patch: { subscriptionStatus: "active", planName: PLANO_MANUAL },
    };
  }
  return {
    ok: true,
    patch: { subscriptionStatus: "canceled", planName: null },
  };
}
