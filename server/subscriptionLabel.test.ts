import { describe, expect, it } from "vitest";
import {
  rotuloAssinatura,
  corAssinatura,
} from "../client/src/lib/subscriptionLabel";

describe("rotuloAssinatura", () => {
  it("traduz os status conhecidos do Stripe", () => {
    expect(rotuloAssinatura("active")).toBe("Ativa");
    expect(rotuloAssinatura("trialing")).toBe("Em teste");
    expect(rotuloAssinatura("past_due")).toBe("Pagamento atrasado");
    expect(rotuloAssinatura("canceled")).toBe("Cancelada");
    expect(rotuloAssinatura("unpaid")).toBe("Não paga");
  });

  it("status ausente/desconhecido vira 'Sem assinatura'", () => {
    expect(rotuloAssinatura(null)).toBe("Sem assinatura");
    expect(rotuloAssinatura(undefined)).toBe("Sem assinatura");
    expect(rotuloAssinatura("qualquer_coisa")).toBe("Sem assinatura");
  });
});

describe("corAssinatura", () => {
  it("só active/trialing contam como saudável", () => {
    expect(corAssinatura("active")).toBe("default");
    expect(corAssinatura("trialing")).toBe("default");
    expect(corAssinatura("canceled")).toBe("secondary");
    expect(corAssinatura(null)).toBe("secondary");
  });

  it("cobrança com problema fica em vermelho", () => {
    expect(corAssinatura("past_due")).toBe("destructive");
    expect(corAssinatura("unpaid")).toBe("destructive");
  });
});
