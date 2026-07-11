// Fonte ÚNICA da verdade do financeiro (pura, testável). Consolida as 4 fontes:
//   Receita  = viagens CONCLUÍDAS + receitas manuais "recebido"
//   A Receber= viagens em aberto (planejada/andamento) + receitas manuais "pendente"
//   Despesa  = lançamentos manuais + custo de manutenção CONCLUÍDA
//   Saldo    = Receita − Despesa
// (cancelada/pendente de manutenção não contam). Sem DB → 1ms nos testes.

type MoneyLike = string | number | null | undefined;
type DateLike = string | number | Date | null | undefined;

export type FinanceSources = {
  trips: { status: string; valor: MoneyLike; dataPartida: DateLike }[];
  maintenances: {
    status: string;
    custo: MoneyLike;
    dataRealizada: DateLike;
    dataPrevista: DateLike;
  }[];
  expenses: { valor: MoneyLike; data: DateLike }[];
  revenues: { status: string; valor: MoneyLike; data: DateLike }[];
};

export type FinanceSummary = {
  receitas: number;
  aReceber: number;
  despesas: number;
  saldo: number;
  // Detalhamento (para exibir "de onde vem"):
  receitaViagens: number;
  receitaManual: number;
  despesasManuais: number;
  custoManutencao: number;
};

const num = (v: MoneyLike): number => {
  const n = v == null ? 0 : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const ms = (d: DateLike): number => (d ? new Date(d).getTime() : 0);

export function computeFinanceSummary(
  src: FinanceSources,
  sinceMs?: number | null
): FinanceSummary {
  const inPeriod = (d: DateLike) => sinceMs == null || ms(d) >= sinceMs;

  const receitaViagens = src.trips
    .filter(t => t.status === "concluida" && inPeriod(t.dataPartida))
    .reduce((s, t) => s + num(t.valor), 0);
  const receitaManual = src.revenues
    .filter(r => r.status === "recebido" && inPeriod(r.data))
    .reduce((s, r) => s + num(r.valor), 0);

  const aReceberViagens = src.trips
    .filter(
      t =>
        (t.status === "planejada" || t.status === "em_andamento") &&
        inPeriod(t.dataPartida)
    )
    .reduce((s, t) => s + num(t.valor), 0);
  const aReceberManual = src.revenues
    .filter(r => r.status === "pendente" && inPeriod(r.data))
    .reduce((s, r) => s + num(r.valor), 0);

  const despesasManuais = src.expenses
    .filter(e => inPeriod(e.data))
    .reduce((s, e) => s + num(e.valor), 0);
  const custoManutencao = src.maintenances
    .filter(
      m =>
        m.status === "concluida" && inPeriod(m.dataRealizada || m.dataPrevista)
    )
    .reduce((s, m) => s + num(m.custo), 0);

  const receitas = receitaViagens + receitaManual;
  const aReceber = aReceberViagens + aReceberManual;
  const despesas = despesasManuais + custoManutencao;
  return {
    receitas,
    aReceber,
    despesas,
    saldo: receitas - despesas,
    receitaViagens,
    receitaManual,
    despesasManuais,
    custoManutencao,
  };
}

// ─── Extrato itemizado (fonte única das LISTAS do Financeiro) ────────────────
// Junta lançamentos manuais + viagens (receita) + manutenção concluída (despesa)
// numa lista única, cada item marcado com sua origem e se é editável (só os
// manuais podem ser apagados; viagem/manutenção são geridos nas telas próprias).

export type LedgerSources = {
  trips: {
    id: number;
    numeroViagem: string;
    status: string;
    valor: MoneyLike;
    origem: string;
    destino: string;
    dataPartida: DateLike;
  }[];
  maintenances: {
    id: number;
    status: string;
    tipo: string;
    custo: MoneyLike;
    dataRealizada: DateLike;
    dataPrevista: DateLike;
  }[];
  expenses: {
    id: number;
    tipo: string;
    descricao: string;
    valor: MoneyLike;
    data: DateLike;
  }[];
  revenues: {
    id: number;
    tipo: string;
    descricao: string;
    status: string;
    valor: MoneyLike;
    data: DateLike;
  }[];
};

export type LedgerEntry = {
  kind: "receita" | "despesa";
  origem: "manual" | "viagem" | "manutencao";
  categoria: string; // "Viagem" | "Manutenção" | tipo do lançamento manual
  refId: number;
  descricao: string;
  data: string; // ISO — pronto para ordenar/filtrar no cliente
  valor: number;
  realizado: boolean; // receita recebida/viagem concluída; despesa sempre paga
  editable: boolean; // só manuais podem ser apagados
  status: string; // rótulo curto de exibição
};

const toIso = (d: DateLike): string => (d ? new Date(d).toISOString() : "");

export function computeFinanceLedger(src: LedgerSources): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  for (const t of src.trips) {
    if (t.status === "cancelada") continue;
    const valor = num(t.valor);
    if (valor === 0) continue;
    const realizado = t.status === "concluida";
    entries.push({
      kind: "receita",
      origem: "viagem",
      categoria: "Viagem",
      refId: t.id,
      descricao: `Viagem ${t.numeroViagem}: ${t.origem} → ${t.destino}`,
      data: toIso(t.dataPartida),
      valor,
      realizado,
      editable: false,
      status: realizado ? "Recebido" : "A receber",
    });
  }

  for (const r of src.revenues) {
    if (r.status === "cancelado") continue;
    entries.push({
      kind: "receita",
      origem: "manual",
      categoria: r.tipo,
      refId: r.id,
      descricao: r.descricao,
      data: toIso(r.data),
      valor: num(r.valor),
      realizado: r.status === "recebido",
      editable: true,
      status: r.status === "recebido" ? "Recebido" : "Pendente",
    });
  }

  for (const m of src.maintenances) {
    if (m.status !== "concluida") continue;
    const valor = num(m.custo);
    if (valor === 0) continue;
    entries.push({
      kind: "despesa",
      origem: "manutencao",
      categoria: "Manutenção",
      refId: m.id,
      descricao: `Manutenção: ${m.tipo}`,
      data: toIso(m.dataRealizada || m.dataPrevista),
      valor,
      realizado: true,
      editable: false,
      status: "Pago",
    });
  }

  for (const e of src.expenses) {
    entries.push({
      kind: "despesa",
      origem: "manual",
      categoria: e.tipo,
      refId: e.id,
      descricao: e.descricao,
      data: toIso(e.data),
      valor: num(e.valor),
      realizado: true,
      editable: true,
      status: "Pago",
    });
  }

  // Mais recentes primeiro.
  return entries.sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0
  );
}

export type MonthPoint = {
  month: string;
  receita: number;
  custos: number;
  lucro: number;
};

// Série mensal (últimos N meses) com as MESMAS regras do resumo. `nowMs` entra
// como parâmetro para manter a função pura/determinística.
export function computeMonthlySeries(
  src: FinanceSources,
  nowMs: number,
  monthsBack = 6
): MonthPoint[] {
  const now = new Date(nowMs);
  const points: MonthPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const sameMonth = (dl: DateLike) => {
      if (!dl) return false;
      const dt = new Date(dl);
      return dt.getFullYear() === y && dt.getMonth() === m;
    };
    const receita =
      src.trips
        .filter(t => t.status === "concluida" && sameMonth(t.dataPartida))
        .reduce((s, t) => s + num(t.valor), 0) +
      src.revenues
        .filter(r => r.status === "recebido" && sameMonth(r.data))
        .reduce((s, r) => s + num(r.valor), 0);
    const custos =
      src.expenses
        .filter(e => sameMonth(e.data))
        .reduce((s, e) => s + num(e.valor), 0) +
      src.maintenances
        .filter(
          mt =>
            mt.status === "concluida" &&
            sameMonth(mt.dataRealizada || mt.dataPrevista)
        )
        .reduce((s, mt) => s + num(mt.custo), 0);
    points.push({
      month: d.toLocaleString("pt-BR", { month: "short" }),
      receita,
      custos,
      lucro: receita - custos,
    });
  }
  return points;
}
