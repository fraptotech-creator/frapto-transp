// Controle de acesso MANUAL do dono da plataforma (super-admin), para QUALQUER
// empresa — inclusive as que assinam pelo Stripe.
//
// Decisão PURA (entra a ação, sai o que gravar). O efeito no banco fica na borda,
// no router. Grava a coluna `accessOverride` — SEPARADA do subscriptionStatus —
// justamente para o webhook do Stripe NUNCA desfazer o bloqueio manual:
//   - accessOverride "blocked" → corta o acesso mesmo com Stripe ativo;
//   - accessOverride "active"  → concede acesso sem Stripe (cortesia/pgto por fora);
//   - accessOverride null      → "automático": volta a seguir o Stripe.
//
// ⚠️ Bloquear aqui tira o ACESSO, mas NÃO cancela a cobrança do Stripe. Para
// parar de cobrar um assinante do Stripe, cancele no painel do Stripe.

export type AcaoAcesso = "liberar" | "bloquear" | "desbloquear";

export interface OrgParaAcesso {
  id?: number;
}

export type PatchAcesso = { accessOverride: "active" | "blocked" | null };

export type DecisaoAcesso =
  | { ok: true; patch: PatchAcesso }
  | { ok: false; motivo: string };

export function decidirMudancaAcesso(
  org: OrgParaAcesso | null | undefined,
  acao: AcaoAcesso
): DecisaoAcesso {
  if (!org) {
    return { ok: false, motivo: "Empresa não encontrada." };
  }
  if (acao === "bloquear") {
    return { ok: true, patch: { accessOverride: "blocked" } };
  }
  if (acao === "liberar") {
    return { ok: true, patch: { accessOverride: "active" } };
  }
  // desbloquear = volta ao automático (segue o Stripe).
  return { ok: true, patch: { accessOverride: null } };
}
