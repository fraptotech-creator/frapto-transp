import { describe, it, expect } from "vitest";
import {
  computeFinanceSummary,
  computeMonthlySeries,
  computeFinanceLedger,
} from "./_core/finance";

// Cenário do usuário: 2 viagens concluídas (2000+3000), 1 manutenção de óleo
// concluída (1200), 1 despesa de combustível (500), sem receita manual.
const src = {
  trips: [
    {
      status: "concluida",
      pago: true,
      valor: "2000",
      dataPartida: "2026-06-15",
    },
    {
      status: "concluida",
      pago: true,
      valor: "3000",
      dataPartida: "2026-07-07",
    },
    // concluída mas NÃO paga → conta como A RECEBER (pagamento é independente)
    {
      status: "concluida",
      pago: false,
      valor: "500",
      dataPartida: "2026-07-10",
    },
    {
      status: "planejada",
      pago: false,
      valor: "800",
      dataPartida: "2026-07-20",
    },
    {
      status: "cancelada",
      pago: true,
      valor: "999",
      dataPartida: "2026-07-01",
    },
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

  it("receita = viagens PAGAS + receita manual recebida", () => {
    expect(r.receitaViagens).toBe(5000); // só as 2 pagas (2000+3000)
    expect(r.receitaManual).toBe(100);
    expect(r.receitas).toBe(5100);
  });

  it("a receber = viagens não pagas (inclui concluída não paga) + pendente", () => {
    // 500 concluída-não-paga + 800 planejada + 200 receita pendente
    expect(r.aReceber).toBe(1500);
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

describe("computeFinanceLedger", () => {
  const ledgerSrc = {
    trips: [
      {
        id: 1,
        numeroViagem: "V1",
        status: "concluida",
        pago: true,
        valor: "2000",
        origem: "A",
        destino: "B",
        dataPartida: "2026-07-07",
      },
      {
        id: 2,
        numeroViagem: "V2",
        status: "planejada",
        pago: false,
        valor: "800",
        origem: "C",
        destino: "D",
        dataPartida: "2026-07-20",
      },
      {
        id: 3,
        numeroViagem: "V3",
        status: "cancelada",
        pago: false,
        valor: "999",
        origem: "E",
        destino: "F",
        dataPartida: "2026-07-01",
      },
      {
        id: 4,
        numeroViagem: "V4",
        status: "concluida",
        pago: false,
        valor: "700",
        origem: "G",
        destino: "H",
        dataPartida: "2026-07-11",
      },
    ],
    maintenances: [
      {
        id: 10,
        status: "concluida",
        tipo: "Troca de óleo",
        custo: "1200",
        dataRealizada: "2026-07-08",
        dataPrevista: "2026-07-09",
      },
      {
        id: 11,
        status: "pendente",
        tipo: "Revisão",
        custo: "5000",
        dataRealizada: null,
        dataPrevista: "2026-07-30",
      },
    ],
    expenses: [
      {
        id: 20,
        tipo: "combustivel",
        descricao: "posto",
        valor: "500",
        data: "2026-07-08",
      },
    ],
    revenues: [
      {
        id: 30,
        tipo: "frete",
        descricao: "frete X",
        status: "recebido",
        valor: "100",
        data: "2026-07-05",
      },
      {
        id: 31,
        tipo: "frete",
        descricao: "frete Y",
        status: "cancelado",
        valor: "999",
        data: "2026-07-06",
      },
    ],
  };

  const entries = computeFinanceLedger(ledgerSrc);

  it("inclui viagem (não cancelada), receita/despesa manual e manutenção concluída", () => {
    const kinds = entries.map(e => `${e.kind}:${e.origem}:${e.refId}`);
    expect(kinds).toContain("receita:viagem:1"); // concluída
    expect(kinds).toContain("receita:viagem:2"); // planejada = a receber
    expect(kinds).toContain("receita:manual:30");
    expect(kinds).toContain("despesa:manutencao:10");
    expect(kinds).toContain("despesa:manual:20");
  });

  it("exclui viagem cancelada, receita cancelada e manutenção pendente", () => {
    expect(entries.find(e => e.refId === 3)).toBeUndefined(); // viagem cancelada
    expect(entries.find(e => e.refId === 31)).toBeUndefined(); // receita cancelada
    expect(
      entries.find(e => e.origem === "manutencao" && e.refId === 11)
    ).toBeUndefined();
  });

  it("vincula a placa do veículo na despesa; despesa geral fica null", () => {
    const es = computeFinanceLedger(
      {
        trips: [],
        maintenances: [],
        expenses: [
          {
            id: 1,
            tipo: "combustivel",
            descricao: "posto",
            valor: "100",
            data: "2026-07-01",
            veiculoId: 7,
          },
          {
            id: 2,
            tipo: "pedagio",
            descricao: "praça",
            valor: "20",
            data: "2026-07-01",
          },
        ],
        revenues: [],
      },
      [{ id: 7, placa: "ABC1234" }]
    );
    expect(es.find(e => e.refId === 1)!.veiculo).toBe("ABC1234");
    expect(es.find(e => e.refId === 2)!.veiculo).toBeNull();
  });

  it("só os manuais são editáveis; realizado = viagem PAGA (não o status)", () => {
    expect(entries.find(e => e.refId === 20)!.editable).toBe(true);
    expect(entries.find(e => e.refId === 10)!.editable).toBe(false);
    expect(entries.find(e => e.refId === 2)!.realizado).toBe(false); // planejada não paga
    expect(entries.find(e => e.refId === 1)!.realizado).toBe(true); // paga
    // concluída mas NÃO paga → NÃO é realizado (a receber)
    const v4 = entries.find(e => e.refId === 4)!;
    expect(v4.realizado).toBe(false);
    expect(v4.status).toBe("A receber");
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
