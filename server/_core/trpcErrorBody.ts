import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";

/**
 * Monta um corpo de erro no formato que o CLIENTE tRPC entende.
 *
 * Por que existe: middlewares que barram a requisição ANTES do tRPC (rate-limit,
 * checagem de Origin) respondiam `{ error: "texto" }`. É JSON válido, mas fora
 * do envelope do tRPC — então o cliente não consegue desserializar e mostra
 * "Unable to transform response from server", escondendo o motivo real.
 * Com este formato, o usuário lê "Muitas requisições..." em vez de um erro
 * de framework que não ajuda ninguém.
 *
 * O número do código vem do próprio tRPC (TRPC_ERROR_CODES_BY_KEY), não de
 * uma tabela copiada — se a biblioteca mudar, acompanhamos.
 */
export type TrpcErrorKey = keyof typeof TRPC_ERROR_CODES_BY_KEY;

export function trpcErrorBody(
  code: TrpcErrorKey,
  httpStatus: number,
  message: string
) {
  return {
    error: {
      json: {
        message,
        code: TRPC_ERROR_CODES_BY_KEY[code],
        data: { code, httpStatus },
      },
    },
  };
}

// O envelope só serve para chamadas do cliente tRPC. Fora de /api/trpc
// (webhook do Stripe, /api/track do app nativo) o formato simples é o certo.
//
// ⚠️ Passe `req.originalUrl`, NÃO `req.path`. Estes middlewares são montados
// com prefixo (app.use("/api/trpc", ...)), e nesse caso o Express entrega o
// req.path SEM o prefixo ("/documents.downloadUrl") — a comparação daria
// falso sempre. Descoberto validando ao vivo; os testes não pegam porque
// chamam a função direto.
//
// Aceita undefined de propósito: isto roda dentro do middleware de CSRF, que
// não pode estourar por um campo ausente. Sem caminho conhecido, devolve o
// formato simples — o mesmo de antes desta mudança.
export function isTrpcRequest(urlOriginal: string | undefined): boolean {
  return typeof urlOriginal === "string" && urlOriginal.startsWith("/api/trpc");
}
