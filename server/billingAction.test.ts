import { describe, expect, it } from "vitest";
import { acaoPaywall, podeAbrirPortal } from "../client/src/lib/billingAction";

const base = { configured: true, hasBilling: true };

describe("acaoPaywall", () => {
  it("cartão vencido manda GERENCIAR, não assinar de novo", () => {
    // O bug que isto evita: abrir checkout novo geraria uma SEGUNDA assinatura
    // enquanto a primeira segue cobrando.
    expect(acaoPaywall({ ...base, status: "past_due" })).toBe("gerenciar");
    expect(acaoPaywall({ ...base, status: "unpaid" })).toBe("gerenciar");
  });

  it("quem nunca assinou vai para ASSINAR", () => {
    expect(
      acaoPaywall({ configured: true, hasBilling: false, status: "none" })
    ).toBe("assinar");
  });

  it("quem cancelou assina de novo (portal não recria assinatura)", () => {
    expect(acaoPaywall({ ...base, status: "canceled" })).toBe("assinar");
  });

  it("past_due SEM cliente no Stripe não pode ir ao portal", () => {
    // Estado inconsistente: sem stripeCustomerId o portal lançaria erro.
    expect(
      acaoPaywall({ configured: true, hasBilling: false, status: "past_due" })
    ).toBe("assinar");
  });

  it("Stripe não configurado bloqueia tudo (fail-closed)", () => {
    expect(
      acaoPaywall({ ...base, configured: false, status: "past_due" })
    ).toBe("indisponivel");
    expect(acaoPaywall({ ...base, configured: false, status: "none" })).toBe(
      "indisponivel"
    );
  });
});

describe("podeAbrirPortal", () => {
  it("exige ser cliente no Stripe E ter cobrança configurada", () => {
    expect(podeAbrirPortal({ ...base, status: "active" })).toBe(true);
    expect(
      podeAbrirPortal({ configured: true, hasBilling: false, status: "active" })
    ).toBe(false);
    expect(
      podeAbrirPortal({ configured: false, hasBilling: true, status: "active" })
    ).toBe(false);
  });
});
