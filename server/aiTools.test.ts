import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({
  getVehicles: vi.fn().mockResolvedValue([
    {
      id: 1,
      placa: "AAA1111",
      marca: "Volvo",
      modelo: "FH",
      status: "ativo",
      quilometragem: 9500,
      kmUltimaTrocaOleo: 9500,
      intervaloTrocaOleoKm: 10000,
    },
  ]),
  getDrivers: vi.fn().mockResolvedValue([]),
  getTrips: vi.fn().mockResolvedValue([]),
  getMaintenances: vi.fn().mockResolvedValue([]),
  getExpenses: vi.fn().mockResolvedValue([]),
  getRevenues: vi.fn().mockResolvedValue([]),
}));

import { runAiTool, toOpenAiTools } from "./_core/aiTools";

describe("aiTools", () => {
  it("expõe as ferramentas no formato OpenAI", () => {
    const names = toOpenAiTools().map(t => t.function.name);
    expect(names).toContain("listar_veiculos");
    expect(names).toContain("listar_viagens");
    expect(names).toContain("resumo_financeiro");
    expect(names).toContain("extrato_financeiro");
  });

  it("listar_veiculos devolve placa + situação do óleo", async () => {
    const data = JSON.parse(await runAiTool(1, "listar_veiculos", "{}"));
    expect(data[0].placa).toBe("AAA1111");
    expect(data[0].oleo).toBe("em dia");
  });

  it("ferramenta desconhecida → erro (não lança)", async () => {
    const out = JSON.parse(await runAiTool(1, "xpto", "{}"));
    expect(out.erro).toMatch(/desconhecida/i);
  });

  it("args em JSON inválido não quebram", async () => {
    const data = JSON.parse(await runAiTool(1, "listar_veiculos", "{quebrado"));
    expect(data[0].placa).toBe("AAA1111");
  });
});
