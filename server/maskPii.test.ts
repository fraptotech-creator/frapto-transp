import { describe, it, expect } from "vitest";
import { maskPii } from "./_core/maskPii";

describe("maskPii — mascara PII em logs (item 7)", () => {
  it("redige e-mail", () => {
    expect(maskPii("contato joao@empresa.com.br agora")).toBe(
      "contato «email» agora"
    );
  });

  it("redige CPF, telefone e CNH (8+ dígitos)", () => {
    expect(maskPii("CPF 123.456.789-01")).toBe("CPF «num»");
    expect(maskPii("tel 27 99999-0000")).toContain("«num»");
    expect(maskPii("CNH 99999999999")).toBe("CNH «num»");
  });

  it("NÃO mascara números curtos (não-PII)", () => {
    expect(maskPii("sala 12, R$ 57")).toBe("sala 12, R$ 57");
  });

  it("mistura: e-mail + telefone numa frase", () => {
    const out = maskPii("Motorista a@b.com, fone (27) 3333-4444.");
    expect(out).toContain("«email»");
    expect(out).toContain("«num»");
    expect(out).not.toContain("a@b.com");
    expect(out).not.toContain("3333-4444");
  });

  it("string vazia passa direto", () => {
    expect(maskPii("")).toBe("");
  });
});
