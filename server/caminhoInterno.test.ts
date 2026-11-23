import { describe, expect, it } from "vitest";
import { caminhoInterno } from "../client/src/lib/caminhoInterno";

// Trava da auditoria 23/11/2026: RedefinirSenha aceitava ?next=//evil.com
// (passava no startsWith("/")) → redirecionamento aberto após o reset.
describe("caminhoInterno", () => {
  it("caminho interno passa", () => {
    expect(caminhoInterno("/motorista")).toBe("/motorista");
    expect(caminhoInterno("/dashboard?x=1")).toBe("/dashboard?x=1");
  });
  it("protocol-relative e absoluto caem no padrão", () => {
    expect(caminhoInterno("//evil.com")).toBe("/");
    expect(caminhoInterno("/\\evil.com")).toBe("/");
    expect(caminhoInterno("https://evil.com")).toBe("/");
  });
  it("vazio/nulo caem no padrão", () => {
    expect(caminhoInterno("")).toBe("/");
    expect(caminhoInterno(null)).toBe("/");
    expect(caminhoInterno(undefined, "/login")).toBe("/login");
  });
});
