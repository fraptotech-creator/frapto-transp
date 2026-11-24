import { describe, it, expect } from "vitest";
import { confirmarExclusao, linhasAfetadas } from "./_core/exclusao";

// Teste pré-venda 23/11/2026: excluir id inexistente respondia { success: true }.
describe("confirmarExclusao", () => {
  it("apagou pelo menos 1 linha → sucesso", () => {
    expect(confirmarExclusao(1, "Viagem não encontrada.")).toEqual({
      success: true,
    });
  });

  it("0 linhas → NOT_FOUND com mensagem legível", () => {
    expect(() => confirmarExclusao(0, "Viagem não encontrada.")).toThrow(
      expect.objectContaining({
        code: "NOT_FOUND",
        message: expect.stringMatching(/^Viagem não encontrada\. O registro/),
      })
    );
  });
});

describe("linhasAfetadas (resultado do DELETE do mysql2)", () => {
  it("lê affectedRows do [ResultSetHeader, ...]", () => {
    expect(linhasAfetadas([{ affectedRows: 1 }, undefined])).toBe(1);
    expect(linhasAfetadas([{ affectedRows: 0 }])).toBe(0);
  });

  it("formato desconhecido conta como 0 (fail-closed: não diz 'excluído')", () => {
    expect(linhasAfetadas(undefined)).toBe(0);
    expect(linhasAfetadas([])).toBe(0);
    expect(linhasAfetadas([{ affectedRows: "1" }])).toBe(0);
  });
});
