import { ENV } from "./env";

// Envio transacional via Resend. Usa fetch direto em vez do SDK: a API é um
// POST só, e não vale acrescentar dependência (e risco de lockfile no deploy)
// por isso.

const API = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export function isEmailConfigured(): boolean {
  return Boolean(ENV.resendApiKey && ENV.emailRemetente);
}

/**
 * Envia e LANÇA se falhar.
 *
 * Falhar alto é proposital: o chamador precisa saber que não enviou, para não
 * dizer ao usuário "enviamos o link" quando nada saiu. Cliente esperando um
 * e-mail que nunca vem é o pior desfecho — foi exatamente o que aconteceu com
 * o webhook do Stripe nesta implantação.
 */
export async function enviarEmail(params: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Envio de e-mail não configurado (RESEND_API_KEY).");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ENV.emailRemetente,
        to: [params.para],
        subject: params.assunto,
        html: params.html,
        text: params.texto,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Corpo do Resend traz o motivo (domínio não verificado, remetente
      // inválido...). Vai para o log do servidor, NUNCA para o usuário.
      const detalhe = await res.text().catch(() => "");
      throw new Error(
        `Resend recusou (${res.status}): ${detalhe.slice(0, 300)}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
