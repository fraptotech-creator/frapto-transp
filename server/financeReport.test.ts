import { describe, expect, it } from "vitest";
import { filtrarLedgerPorMes, resumoAnualPorMes } from "@/lib/financeReport";

const ledger = [
  { kind: "receita" as const, data: "2026-07-05T10:00:00.000Z", valor: 1000 },
  { kind: "despesa" as const, data: "2026-07-20T10:00:00.000Z", valor: 300 },
  { kind: "receita" as const, data: "2026-08-01T10:00:00.000Z", valor: 500 },
  { kind: "receita" as const, data: "2025-07-01T10:00:00.000Z", valor: 999 },
];

describe("filtrarLedgerPorMes", () => {
  it("pega só os lançamentos do mês", () => {
    expect(filtrarLedgerPorMes(ledger, "2026-07")).toHaveLength(2);
    expect(filtrarLedgerPorMes(ledger, "2026-08")).toHaveLength(1);
    expect(filtrarLedgerPorMes(ledger, "2026-01")).toHaveLength(0);
  });
});

describe("resumoAnualPorMes", () => {
  it("soma receita/despesa/lucro por mês do ano", () => {
    const r = resumoAnualPorMes(ledger, 2026);
    expect(r).toHaveLength(12);
    const jul = r[6]; // julho
    expect(jul.receita).toBe(1000);
    expect(jul.despesa).toBe(300);
    expect(jul.lucro).toBe(700);
    const ago = r[7];
    expect(ago.receita).toBe(500);
    expect(ago.lucro).toBe(500);
    // 2025 não entra em 2026
    expect(r.reduce((s, m) => s + m.receita, 0)).toBe(1500);
  });
});
