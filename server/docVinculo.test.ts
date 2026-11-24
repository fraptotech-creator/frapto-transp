import { describe, it, expect } from "vitest";
import { vinculoDocumento } from "../client/src/lib/docVinculo";

// Teste pré-venda 23/11/2026: documento não tinha vínculo com veículo/motorista.
const veiculos = [{ id: 10, placa: "ABC1234" }];
const motoristas = [{ id: 20, nome: "Maria Souza" }];

describe("vinculoDocumento", () => {
  it("sem vínculo → texto vazio", () => {
    expect(vinculoDocumento({}, veiculos, motoristas)).toBe("");
    expect(
      vinculoDocumento(
        { veiculoId: null, motoristId: null },
        veiculos,
        motoristas
      )
    ).toBe("");
  });

  it("veículo → placa formatada; motorista → nome", () => {
    expect(vinculoDocumento({ veiculoId: 10 }, veiculos, motoristas)).toBe(
      "ABC-1234"
    );
    expect(vinculoDocumento({ motoristId: 20 }, veiculos, motoristas)).toBe(
      "Maria Souza"
    );
  });

  it("os dois vínculos aparecem juntos", () => {
    expect(
      vinculoDocumento({ veiculoId: 10, motoristId: 20 }, veiculos, motoristas)
    ).toBe("ABC-1234 · Maria Souza");
  });

  it("id que não existe mais na lista não some calado", () => {
    expect(vinculoDocumento({ veiculoId: 99 }, veiculos, motoristas)).toBe(
      "Veículo removido"
    );
    expect(vinculoDocumento({ motoristId: 99 }, veiculos, motoristas)).toBe(
      "Motorista removido"
    );
  });
});
