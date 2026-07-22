// Estado do cliente ao VOLTAR do checkout do Stripe.
//
// Problema que isto resolve: o Stripe devolve para /?checkout=success, mas a
// liberação depende do webhook, que pode demorar alguns segundos. Nesse
// intervalo o paywall mostrava "Assinar por R$ 57/mês" para quem ACABOU de
// pagar — e clicar ali abre um SEGUNDO checkout, gerando cobrança dupla.
// Aconteceu de verdade nesta implantação.
//
// Funções puras, testadas em server/checkoutRetorno.test.ts.

export type EstadoRetorno = "aguardando" | "demorou" | "normal";

// Quanto tempo esperar o webhook antes de admitir que algo pode ter falhado.
export const LIMITE_ESPERA_MS = 40_000;

export function voltouDoCheckout(search: string): boolean {
  return new URLSearchParams(search).get("checkout") === "success";
}

/**
 * `aguardando` → esconde o botão de assinar e mostra "confirmando pagamento".
 * `demorou`    → passou do limite; orienta o cliente em vez de deixá-lo no vazio.
 * `normal`     → fluxo comum (nunca pagou, ou cancelou o checkout).
 */
export function estadoRetorno(params: {
  voltouDoCheckout: boolean;
  assinaturaAtiva: boolean;
  msDesdeRetorno: number;
}): EstadoRetorno {
  // Assinatura já ativa não é caso de espera — o paywall nem aparece.
  if (!params.voltouDoCheckout || params.assinaturaAtiva) return "normal";
  return params.msDesdeRetorno >= LIMITE_ESPERA_MS ? "demorou" : "aguardando";
}

// Enquanto espera o webhook, o cliente NÃO pode disparar outro checkout.
export function podeAssinar(estado: EstadoRetorno): boolean {
  return estado === "normal";
}
