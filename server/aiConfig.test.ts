import { describe, it, expect } from "vitest";
import { pickAiConfig } from "./routers/_helpers";

const groqDefaults = {
  key: "gsk_teste",
  provider: "openai_compatible",
  model: "llama-3.3-70b-versatile",
  baseUrl: "https://api.groq.com/openai/v1",
  anthropicKey: "",
};
const noDefaults = {
  key: "",
  provider: "openai_compatible",
  model: "",
  baseUrl: "",
  anthropicKey: "",
};

describe("pickAiConfig", () => {
  it("usa a config da EMPRESA quando ativa e com chave", () => {
    const r = pickAiConfig(
      {
        provider: "openai",
        apiKey: "sk-empresa",
        model: "gpt-4o-mini",
        baseUrl: null,
        enabled: true,
      },
      groqDefaults
    );
    expect(r).toEqual({
      provider: "openai",
      apiKey: "sk-empresa",
      model: "gpt-4o-mini",
      baseUrl: null,
    });
  });

  it("empresa desativada → cai no PADRÃO do sistema (Groq)", () => {
    const r = pickAiConfig(
      {
        provider: "openai",
        apiKey: "sk-empresa",
        model: "x",
        baseUrl: null,
        enabled: false,
      },
      groqDefaults
    );
    expect(r?.provider).toBe("openai_compatible");
    expect(r?.apiKey).toBe("gsk_teste");
    expect(r?.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(r?.model).toBe("llama-3.3-70b-versatile");
  });

  it("sem empresa → PADRÃO do sistema", () => {
    const r = pickAiConfig(null, groqDefaults);
    expect(r?.apiKey).toBe("gsk_teste");
  });

  it("provider inválido no padrão → openai_compatible", () => {
    const r = pickAiConfig(null, { ...groqDefaults, provider: "xpto" });
    expect(r?.provider).toBe("openai_compatible");
  });

  it("sem padrão mas com Anthropic legado → Claude", () => {
    const r = pickAiConfig(null, { ...noDefaults, anthropicKey: "sk-ant" });
    expect(r).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant",
      model: "claude-haiku-4-5",
      baseUrl: null,
    });
  });

  it("nada configurado → null", () => {
    expect(pickAiConfig(null, noDefaults)).toBeNull();
  });
});
