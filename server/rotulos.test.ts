import { describe, it, expect } from "vitest";
import { rotulo } from "../client/src/lib/rotulos";

// Trava do teste pré-venda 23/11/2026: a tela capitalizava o valor cru do
// banco ("Caminhao", "Em_andamento", "Combustivel").
describe("rotulo", () => {
  it("enums conhecidos saem com acento e sem sublinhado", () => {
    expect(rotulo("caminhao")).toBe("Caminhão");
    expect(rotulo("onibus")).toBe("Ônibus");
    expect(rotulo("em_andamento")).toBe("Em andamento");
    expect(rotulo("concluida")).toBe("Concluída");
    expect(rotulo("combustivel")).toBe("Combustível");
    expect(rotulo("pedagio")).toBe("Pedágio");
  });

  it("rótulo já pronto do servidor passa intacto", () => {
    expect(rotulo("Viagem")).toBe("Viagem");
    expect(rotulo("Manutenção")).toBe("Manutenção");
  });

  it("valor desconhecido não some: capitaliza e tira o _", () => {
    expect(rotulo("novo_status")).toBe("Novo status");
    expect(rotulo(null)).toBe("");
  });
});
