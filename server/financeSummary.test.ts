import { describe, it, expect } from "vitest";
import { computeFinanceSummary, computeMonthlySeries } from "./_core/finance";

// Cenário do usuário: 2 viagens concluídas (2000+3000), 1 manutenção de óleo
// concluída (1200), 1 despesa de combustível (500), sem receita manual.
const src = {
  trips: [
    { status: "concluida", valor: "2000", dataPartida: "2026-06-15" },
    { status: "concluida", valor: "3000", dataPartida: "2026-07-07" },
    { status: "planejada", valor: "800", dataPartida: "2026-07-20" },
    { status: "cancelada", valor: "999", dataPartida: "2026-07-01" },
  ],
  maintenances: [
    {
      status: "concluida",
      custo: "1200",
      dataRealizada: "2026-07-07",
      dataPrevista: "2026-07-08",
    },
    {
      status: "pendente",
      custo: "5000",
      dataRealizada: null,
      dataPrevista: "2026-07-30",
    },
  ],
  expenses: [{ valor: "500", data: "2026-07-08" }],
  revenues: [
    { status: "recebido", valor: "100", data: "2026-07-05" },
    { status: "pendente", valor: "200", data: "2026-07-06" },
    { status: "cancelado", valor: "999", data: "2026-07-06" },
  ],
};

describe("computeFinanceSummary", () => {
  const r = computeFinanceSummary(src);

  it("receita = viagens concluídas + receita manual recebida", () => {
    expect(r.receitaViagens).toBe(5000);
    expect(r.receitaManual).toBe(100);
    expect(r.receitas).toBe(5100);
  });

  it("a receber = viagens abertas + receita manual pendente (cancelada fora)", () => {
    expect(r.aReceber).toBe(1000); // 800 viagem planejada + 200 pendente
  });

  it("despesa = manuais + manutenção CONCLUÍDA (pendente de fora)", () => {
    expect(r.despesasManuais).toBe(500);
    expect(r.custoManutencao).toBe(1200); // ignora a manutenção pendente de 5000
    expect(r.despesas).toBe(1700);
  });

  it("saldo = receitas − despesas", () => {
    expect(r.saldo).toBe(5100 - 1700);
  });

  it("filtro de período corta o que é anterior", () => {
    const soJulho = computeFinanceSummary(
      src,
      new Date("2026-07-01").getTime()
    );
    // a viagem de junho (2000) sai; sobra 3000
    expect(soJulho.receitaViagens).toBe(3000);
  });
});

describe("computeMonthlySeries", () => {
  it("agrupa por mês com as mesmas regras", () => {
    const nowMs = new Date("2026-07-15").getTime();
    const series = computeMonthlySeries(src, nowMs, 6);
    expect(series).toHaveLength(6);
    const jul = series[series.length - 1];
    // julho: receita 3000(viagem)+100(recebido)=3100; custos 500+1200=1700
    expect(jul.receita).toBe(3100);
    expect(jul.custos).toBe(1700);
    expect(jul.lucro).toBe(1400);
  });
});
