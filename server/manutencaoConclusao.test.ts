import { describe, it, expect } from "vitest";
import { dataRealizadaAoConcluir } from "./_core/manutencaoConclusao";

// Trava da auditoria pré-venda 23/11/2026: concluir sem data fazia o custo da
// manutenção cair no mês PREVISTO no financeiro.
describe("dataRealizadaAoConcluir", () => {
  const agora = new Date("2026-11-23T15:00:00Z"); // 12h em Brasília

  it("concluindo sem data → hoje, à meia-noite UTC", () => {
    expect(
      dataRealizadaAoConcluir(
        "concluida",
        undefined,
        null,
        agora
      )?.toISOString()
    ).toBe("2026-11-23T00:00:00.000Z");
  });

  it("usa o dia de BRASÍLIA (22h de lá já é amanhã em UTC)", () => {
    const noite = new Date("2026-11-24T01:30:00Z"); // 22h30 de 23/11 em Brasília
    expect(
      dataRealizadaAoConcluir(
        "concluida",
        undefined,
        null,
        noite
      )?.toISOString()
    ).toBe("2026-11-23T00:00:00.000Z");
  });

  it("não sobrescreve data informada nem já gravada", () => {
    const d = new Date("2026-11-10T00:00:00Z");
    expect(
      dataRealizadaAoConcluir("concluida", d, null, agora)
    ).toBeUndefined();
    expect(
      dataRealizadaAoConcluir("concluida", undefined, d, agora)
    ).toBeUndefined();
  });

  it("outros status não ganham data", () => {
    expect(
      dataRealizadaAoConcluir("em_andamento", undefined, null, agora)
    ).toBeUndefined();
    expect(
      dataRealizadaAoConcluir(undefined, undefined, null, agora)
    ).toBeUndefined();
  });
});
