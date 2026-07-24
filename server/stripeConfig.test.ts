import { describe, expect, it } from "vitest";
import { stripeConfigCompleta } from "./_core/stripe";

const full = {
  secretKey: "sk_live_x",
  priceId: "price_x",
  webhookSecret: "whsec_x",
};

describe("stripeConfigCompleta", () => {
  it("só é completa com os TRÊS segredos", () => {
    expect(stripeConfigCompleta(full)).toBe(true);
  });

  it("SEM webhook secret é incompleta (bug que travava o cliente pagante)", () => {
    // Sem webhook o pagamento é cobrado e ninguém liberado. O checkout NÃO
    // pode abrir nesse estado.
    expect(stripeConfigCompleta({ ...full, webhookSecret: "" })).toBe(false);
  });

  it("sem secret key ou sem price também é incompleta", () => {
    expect(stripeConfigCompleta({ ...full, secretKey: "" })).toBe(false);
    expect(stripeConfigCompleta({ ...full, priceId: "" })).toBe(false);
  });

  it("nada configurado é incompleta (fail-closed)", () => {
    expect(
      stripeConfigCompleta({ secretKey: "", priceId: "", webhookSecret: "" })
    ).toBe(false);
  });
});
