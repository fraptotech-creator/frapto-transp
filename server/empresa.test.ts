import { describe, it, expect } from "vitest";
import { EMPRESA, IDENTIFICACAO_EMPRESA } from "../client/src/lib/empresa";

// Dígitos verificadores do CNPJ (algoritmo oficial da Receita). Trava contra
// erro de digitação: o CNPJ aparece nos Termos, na Privacidade e nos rodapés.
function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "").split("").map(Number);
  if (d.length !== 14 || d.every(n => n === d[0])) return false;
  const dv = (base: number[]): number => {
    let peso = base.length - 7;
    const soma = base.reduce((acc, n) => {
      const s = acc + n * peso;
      peso = peso === 2 ? 9 : peso - 1;
      return s;
    }, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(d.slice(0, 12)) === d[12] && dv(d.slice(0, 13)) === d[13];
}

describe("identificação da empresa (Decreto 7.962/2013)", () => {
  it("CNPJ no formato oficial e com dígitos verificadores válidos", () => {
    expect(EMPRESA.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    expect(cnpjValido(EMPRESA.cnpj)).toBe(true);
  });

  it("o validador recusa CNPJ com dígito errado (sanidade do teste)", () => {
    expect(cnpjValido("51.156.210/0001-05")).toBe(false);
    expect(cnpjValido("11.111.111/1111-11")).toBe(false);
  });

  it("a linha de rodapé traz razão social, CNPJ e endereço", () => {
    expect(IDENTIFICACAO_EMPRESA).toContain(EMPRESA.razaoSocial);
    expect(IDENTIFICACAO_EMPRESA).toContain(EMPRESA.cnpj);
    expect(IDENTIFICACAO_EMPRESA).toContain(EMPRESA.endereco);
  });
});
