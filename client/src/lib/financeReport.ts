// Helpers PUROS para os relatórios financeiros (detalhado por mês / geral por
// ano), a partir do ledger consolidado. Usa fatia de string da data ISO
// (evita bugs de fuso do new Date()).

export interface LedgerLike {
  kind: "receita" | "despesa";
  data: string; // ISO
  valor: number;
}

// Lançamentos de um mês específico (ym = "YYYY-MM").
export function filtrarLedgerPorMes<T extends { data: string }>(
  ledger: T[],
  ym: string
): T[] {
  return ledger.filter(e => (e.data ?? "").slice(0, 7) === ym);
}

export interface ResumoMes {
  mes: string; // "01".."12"
  receita: number;
  despesa: number;
  lucro: number;
}

// Totais por mês (12 meses) de um ANO — receita, despesa e lucro.
export function resumoAnualPorMes(
  ledger: LedgerLike[],
  ano: number
): ResumoMes[] {
  const meses: ResumoMes[] = Array.from({ length: 12 }, (_, i) => ({
    mes: String(i + 1).padStart(2, "0"),
    receita: 0,
    despesa: 0,
    lucro: 0,
  }));
  for (const e of ledger) {
    const y = (e.data ?? "").slice(0, 4);
    const mi = parseInt((e.data ?? "").slice(5, 7), 10) - 1;
    if (y !== String(ano) || mi < 0 || mi > 11) continue;
    if (e.kind === "receita") meses[mi].receita += e.valor;
    else meses[mi].despesa += e.valor;
  }
  for (const m of meses) m.lucro = m.receita - m.despesa;
  return meses;
}
