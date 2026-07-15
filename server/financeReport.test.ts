import { describe, expect, it } from "vitest";
import {
  filtrarLedgerPorMes,
  resumoAnualPorMes,
  totaisLedger,
} from "@/lib/financeReport";

const ledger = [
  // julho: 1000 recebido + 400 a receber; despesa 300
  {
    kind: "receita" as const,
    data: "2026-07-05T10:00:00.000Z",
    valor: 1000,
    realizado: true,
  },
  {
    kind: "receita" as const,
    data: "2026-07-06T10:00:00.000Z",
    valor: 400,
    realizado: false,
  },
  { kind: "despesa" as const, data: "2026-07-20T10:00:00.000Z", valor: 300 },
  // agosto: 500 recebido
  {
    kind: "receita" as const,
    data: "2026-08-01T10:00:00.000Z",
    valor: 500,
    realizado: true,
  },
  // 2025 não deve entrar em 2026
  {
    kind: "receita" as const,
    data: "2025-07-01T10:00:00.000Z",
    valor: 999,
    realizado: true,
  },
];

describe("filtrarLedgerPorMes", () => {
  it("pega só os lançamentos do mês", () => {
    expect(filtrarLedgerPorMes(ledger, "2026-07")).toHaveLength(3);
    expect(filtrarLedgerPorMes(ledger, "2026-08")).toHaveLength(1);
    expect(filtrarLedgerPorMes(ledger, "2026-01")).toHaveLength(0);
  });
});

describe("resumoAnualPorMes", () => {
  it("separa recebido / a receber / despesa / lucro por mês", () => {
    const r = resumoAnualPorMes(ledger, 2026);
    expect(r).toHaveLength(12);
    const jul = r[6];
    expect(jul.recebido).toBe(1000);
    expect(jul.aReceber).toBe(400);
    expect(jul.despesa).toBe(300);
    expect(jul.lucro).toBe(700); // recebido − despesa (a receber NÃO entra no lucro)
    const ago = r[7];
    expect(ago.recebido).toBe(500);
    expect(ago.aReceber).toBe(0);
    // 2025 fora
    expect(r.reduce((s, m) => s + m.recebido, 0)).toBe(1500);
  });
});

describe("totaisLedger", () => {
  it("soma recebido, a receber e despesa", () => {
    const t = totaisLedger(filtrarLedgerPorMes(ledger, "2026-07"));
    expect(t.recebido).toBe(1000);
    expect(t.aReceber).toBe(400);
    expect(t.despesa).toBe(300);
  });
});
