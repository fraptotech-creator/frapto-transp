import { describe, expect, it } from "vitest";
import { trpcErrorBody, isTrpcRequest } from "./_core/trpcErrorBody";

describe("trpcErrorBody", () => {
  it("monta o envelope que o cliente tRPC consegue desserializar", () => {
    // Formato conferido contra uma resposta REAL do servidor em produção.
    // Se o envelope mudar, o usuário volta a ver "Unable to transform
    // response from server" em vez do motivo — por isso este teste existe.
    expect(trpcErrorBody("FORBIDDEN", 403, "Origem não permitida.")).toEqual({
      error: {
        json: {
          message: "Origem não permitida.",
          code: -32003,
          data: { code: "FORBIDDEN", httpStatus: 403 },
        },
      },
    });
  });

  it("usa o código numérico do próprio tRPC, não um copiado", () => {
    const r = trpcErrorBody("TOO_MANY_REQUESTS", 429, "Muitas requisições.");
    expect(r.error.json.code).toBe(-32029);
    expect(r.error.json.data.code).toBe("TOO_MANY_REQUESTS");
  });

  it("a mensagem chega intacta (é o que o usuário lê)", () => {
    const msg = "Muitas tentativas. Aguarde alguns minutos.";
    expect(
      trpcErrorBody("TOO_MANY_REQUESTS", 429, msg).error.json.message
    ).toBe(msg);
  });
});

describe("isTrpcRequest", () => {
  it("só o /api/trpc usa o envelope", () => {
    expect(isTrpcRequest("/api/trpc/documents.downloadUrl")).toBe(true);
    expect(isTrpcRequest("/api/trpc")).toBe(true);
  });

  it("webhook do Stripe e rastreio nativo NÃO usam (não são clientes tRPC)", () => {
    expect(isTrpcRequest("/api/stripe/webhook")).toBe(false);
    expect(isTrpcRequest("/api/track")).toBe(false);
    expect(isTrpcRequest("/api/ping")).toBe(false);
  });

  it("caminho ausente não derruba o middleware de CSRF", () => {
    // Trava de regressão: a 1ª versão chamava .startsWith em undefined e
    // estourava dentro do originCheck — que é justamente a barreira que
    // não pode falhar.
    expect(isTrpcRequest(undefined)).toBe(false);
  });
});
