import { describe, it, expect } from "vitest";
import {
  sanitizeReturnPath,
  encodeState,
  decodeState,
  nonceConfere,
  decidirLoginGoogle,
} from "./_core/googleLogin";

describe("decidirLoginGoogle — quem entra pelo Google", () => {
  it("sem conta → cria empresa + dono", () => {
    expect(decidirLoginGoogle(null)).toEqual({ acao: "criar" });
    expect(decidirLoginGoogle(undefined)).toEqual({ acao: "criar" });
  });

  // Trava do bug (auditoria 23/11/2026): o token saía sem sver → loop no /login
  // para quem já tinha feito logout/troca de senha.
  it("conta criada pelo Google entra levando o sessionVersion ATUAL", () => {
    expect(
      decidirLoginGoogle({
        orgRole: "owner",
        loginMethod: "google",
        sessionVersion: 3,
      })
    ).toEqual({ acao: "entrar", sessionVersion: 3 });
  });

  // Trava do sequestro por pré-cadastro: conta de SENHA (e-mail nunca
  // confirmado) não é vinculada pelo Google.
  it("conta de senha NÃO é vinculada (anti pré-cadastro)", () => {
    for (const loginMethod of ["password", null, ""]) {
      expect(
        decidirLoginGoogle({ orgRole: "owner", loginMethod, sessionVersion: 0 })
      ).toEqual({ acao: "negar", erro: "google_conta_senha" });
    }
  });

  it("motorista nunca entra pelo Google", () => {
    expect(
      decidirLoginGoogle({
        orgRole: "driver",
        loginMethod: "google",
        sessionVersion: 0,
      })
    ).toEqual({ acao: "negar", erro: "google_driver" });
  });
});

describe("sanitizeReturnPath — só caminho interno (anti open-redirect)", () => {
  it("caminho interno passa", () => {
    expect(sanitizeReturnPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeReturnPath("/motorista?x=1")).toBe("/motorista?x=1");
  });
  it("protocol-relative // vira /dashboard", () => {
    expect(sanitizeReturnPath("//evil.com")).toBe("/dashboard");
  });
  it("URL absoluta vira /dashboard", () => {
    expect(sanitizeReturnPath("https://evil.com")).toBe("/dashboard");
  });
  it("backslash /\\ vira /dashboard", () => {
    expect(sanitizeReturnPath("/\\evil.com")).toBe("/dashboard");
  });
  it("vazio/nulo vira /dashboard", () => {
    expect(sanitizeReturnPath("")).toBe("/dashboard");
    expect(sanitizeReturnPath(null)).toBe("/dashboard");
    expect(sanitizeReturnPath(undefined)).toBe("/dashboard");
  });
});

describe("encodeState / decodeState", () => {
  it("roundtrip preserva nonce e saneia returnPath", () => {
    const raw = encodeState({ returnPath: "/dashboard", nonce: "abc123" });
    const d = decodeState(raw);
    expect(d).toEqual({ returnPath: "/dashboard", nonce: "abc123" });
  });
  it("returnPath malicioso no state é saneado ao decodificar", () => {
    const raw = encodeState({ returnPath: "//evil.com", nonce: "n" });
    expect(decodeState(raw)?.returnPath).toBe("/dashboard");
  });
  it("state corrompido/sem nonce → null", () => {
    expect(decodeState("@@@nao-base64@@@")).toBeNull();
    expect(
      decodeState(Buffer.from('{"returnPath":"/x"}').toString("base64url"))
    ).toBeNull();
    expect(decodeState(null)).toBeNull();
  });
});

describe("nonceConfere — tempo constante", () => {
  it("iguais → true, diferentes/tamanho diferente → false", () => {
    expect(nonceConfere("abc", "abc")).toBe(true);
    expect(nonceConfere("abc", "abd")).toBe(false);
    expect(nonceConfere("abc", "abcd")).toBe(false);
    expect(nonceConfere("", "")).toBe(true);
  });
});
