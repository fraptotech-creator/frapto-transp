import { describe, it, expect, beforeEach } from "vitest";
import {
  assertAccountLoginRateLimit,
  chaveLoginPorConta,
  LIMITE_LOGIN_POR_CONTA,
} from "./routers/_helpers";
import { _resetRateLimit } from "./_core/rateLimit";

// Trava da auditoria pré-venda 23/11/2026: a chave era conta+IP, então cada
// IP novo ganhava tentativas novas e o ataque distribuído contra UMA conta
// (o que esta trava existe para segurar) passava ilimitado.
describe("rate-limit de login por conta", () => {
  beforeEach(() => _resetRateLimit());

  it("a chave não depende do IP e normaliza a conta", () => {
    expect(chaveLoginPorConta("  Joao@X.com ")).toBe("login:acct:joao@x.com");
    expect(chaveLoginPorConta("   ")).toBeNull();
  });

  it("estoura no teto, venham as tentativas de onde vierem", () => {
    for (let i = 0; i < LIMITE_LOGIN_POR_CONTA; i++) {
      expect(() => assertAccountLoginRateLimit("alvo@x.com")).not.toThrow();
    }
    expect(() => assertAccountLoginRateLimit("ALVO@x.com")).toThrow(
      /Muitas tentativas para esta conta/
    );
  });

  it("uma conta travada não afeta outra", () => {
    for (let i = 0; i < LIMITE_LOGIN_POR_CONTA; i++) {
      assertAccountLoginRateLimit("alvo@x.com");
    }
    expect(() => assertAccountLoginRateLimit("outra@x.com")).not.toThrow();
  });
});
