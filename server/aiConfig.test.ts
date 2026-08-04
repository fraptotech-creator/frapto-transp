import { describe, it, expect } from "vitest";
import { pickAiConfig } from "./routers/_helpers";

// FAIL-CLOSED (item 4): a IA acessa dados do cliente → só a config ATIVA da
// PRÓPRIA org habilita o provedor. Sem fallback para chave-padrão do sistema.
describe("pickAiConfig — fail-closed (item 4)", () => {
  it("usa a config da EMPRESA quando ativa e com chave", () => {
    const r = pickAiConfig({
      provider: "openai",
      apiKey: "sk-empresa",
      model: "gpt-4o-mini",
      baseUrl: null,
      enabled: true,
    });
    expect(r).toEqual({
      provider: "openai",
      apiKey: "sk-empresa",
      model: "gpt-4o-mini",
      baseUrl: null,
    });
  });

  it("empresa DESATIVADA → null (NÃO cai em chave padrão)", () => {
    expect(
      pickAiConfig({
        provider: "openai",
        apiKey: "sk-empresa",
        model: "x",
        baseUrl: null,
        enabled: false,
      })
    ).toBeNull();
  });

  it("empresa ativa mas SEM chave → null", () => {
    expect(
      pickAiConfig({
        provider: "openai",
        apiKey: null,
        model: "x",
        baseUrl: null,
        enabled: true,
      })
    ).toBeNull();
  });

  it("sem config da empresa (null/undefined) → null", () => {
    expect(pickAiConfig(null)).toBeNull();
    expect(pickAiConfig(undefined)).toBeNull();
  });
});
