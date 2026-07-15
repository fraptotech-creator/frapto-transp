// Helpers PUROS para os relatórios financeiros (detalhado por mês / geral por
// ano), a partir do ledger consolidado. Usa fatia de string da data ISO
// (evita bugs de fuso do new Date()).

export interface LedgerLike {
  kind: "receita" | "despesa";
  data: string; // ISO
  valor: number;
  realizado?: boolean; // receita: recebida (pago) x a receber
}

// Totais de um conjunto de lançamentos: recebido, a receber e despesa.
export function totaisLedger(entries: LedgerLike[]): {
  recebido: number;
  aReceber: number;
  despesa: number;
} {
  let recebido = 0;
  let aReceber = 0;
  let despesa = 0;
  for (const e of entries) {
    if (e.kind === "receita") {
      if (e.realizado) recebido += e.valor;
      else aReceber += e.valor;
    } else {
      despesa += e.valor;
    }
  }
  return { recebido, aReceber, despesa };
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
  recebido: number; // receita já recebida (paga)
  aReceber: number; // receita ainda não recebida
  despesa: number;
  lucro: number; // recebido − despesa
}

// Totais por mês (12 meses) de um ANO — recebido, a receber, despesa, lucro.
export function resumoAnualPorMes(
  ledger: LedgerLike[],
  ano: number
): ResumoMes[] {
  const meses: ResumoMes[] = Array.from({ length: 12 }, (_, i) => ({
    mes: String(i + 1).padStart(2, "0"),
    recebido: 0,
    aReceber: 0,
    despesa: 0,
    lucro: 0,
  }));
  for (const e of ledger) {
    const y = (e.data ?? "").slice(0, 4);
    const mi = parseInt((e.data ?? "").slice(5, 7), 10) - 1;
    if (y !== String(ano) || mi < 0 || mi > 11) continue;
    if (e.kind === "receita") {
      if (e.realizado) meses[mi].recebido += e.valor;
      else meses[mi].aReceber += e.valor;
    } else {
      meses[mi].despesa += e.valor;
    }
  }
  for (const m of meses) m.lucro = m.recebido - m.despesa;
  return meses;
}
