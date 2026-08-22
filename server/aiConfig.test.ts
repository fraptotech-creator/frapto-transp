import { describe, it, expect } from "vitest";
import { pickAiConfig } from "./routers/_helpers";

// PRECEDÊNCIA: 1º a config ATIVA da PRÓPRIA org; 2º a chave-padrão do sistema
// (fallback grátis, ex.: Groq); 3º o Anthropic legado. Sem `defaults`, é
// FAIL-CLOSED (null). ATENÇÃO LGPD: o fallback faz os dados da empresa passarem
// por uma chave COMPARTILHADA — decisão consciente do admin via env.
const SEM_DEFAULTS = undefined;
const DEFAULTS_GROQ = {
  key: "gsk-sistema",
  provider: "openai_compatible",
  model: "llama-3.3-70b-versatile",
  baseUrl: "https://api.groq.com/openai/v1",
  anthropicKey: "",
};

describe("pickAiConfig — precedência org > padrão > legado", () => {
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

  it("config da empresa TEM PRECEDÊNCIA sobre a chave-padrão", () => {
    const r = pickAiConfig(
      {
        provider: "openai",
        apiKey: "sk-empresa",
        model: "gpt-4o-mini",
        baseUrl: null,
        enabled: true,
      },
      DEFAULTS_GROQ
    );
    expect(r?.apiKey).toBe("sk-empresa");
  });

  it("sem defaults: empresa DESATIVADA → null (fail-closed)", () => {
    expect(
      pickAiConfig(
        {
          provider: "openai",
          apiKey: "sk-empresa",
          model: "x",
          baseUrl: null,
          enabled: false,
        },
        SEM_DEFAULTS
      )
    ).toBeNull();
  });

  it("sem defaults: empresa ativa mas SEM chave → null", () => {
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

  it("sem defaults: sem config da empresa (null/undefined) → null", () => {
    expect(pickAiConfig(null)).toBeNull();
    expect(pickAiConfig(undefined)).toBeNull();
  });

  it("COM defaults: sem config da org → usa a chave-padrão (Groq)", () => {
    const r = pickAiConfig(null, DEFAULTS_GROQ);
    expect(r).toEqual({
      provider: "openai_compatible",
      apiKey: "gsk-sistema",
      model: "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
    });
  });

  it("COM defaults: org DESATIVADA → cai na chave-padrão", () => {
    const r = pickAiConfig(
      {
        provider: "openai",
        apiKey: "sk-empresa",
        model: "x",
        baseUrl: null,
        enabled: false,
      },
      DEFAULTS_GROQ
    );
    expect(r?.apiKey).toBe("gsk-sistema");
  });

  it("provider-padrão desconhecido → normaliza p/ openai_compatible", () => {
    const r = pickAiConfig(null, { ...DEFAULTS_GROQ, provider: "xpto" });
    expect(r?.provider).toBe("openai_compatible");
  });

  it("só Anthropic legado (sem defaultAiKey) → usa Anthropic", () => {
    const r = pickAiConfig(null, {
      key: "",
      provider: "openai_compatible",
      model: "",
      baseUrl: "",
      anthropicKey: "sk-ant-legado",
    });
    expect(r).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-legado",
      model: "claude-haiku-4-5",
      baseUrl: null,
    });
  });

  it("defaults vazios → null (fail-closed mesmo com objeto)", () => {
    const r = pickAiConfig(null, {
      key: "",
      provider: "openai_compatible",
      model: "",
      baseUrl: "",
      anthropicKey: "",
    });
    expect(r).toBeNull();
  });
});
