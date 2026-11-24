import { describe, it, expect, vi } from "vitest";
import { executarRetencaoGps, type DepsRetencao } from "./_core/retencaoGps";

// Tarefa diária de retenção de GPS (24/11/2026). Banco simulado por deps.
const AGORA = new Date("2026-11-24T12:00:00Z");
const CORTE = new Date("2026-08-26T12:00:00Z");

function deps(
  filas: { orgId: number; tripId: number }[][],
  resumir: DepsRetencao["resumirEApagarPosicoesAntigas"]
): DepsRetencao {
  let i = 0;
  return {
    viagensComPosicoesAntigas: vi.fn(
      async () => filas[Math.min(i++, filas.length - 1)] ?? []
    ),
    resumirEApagarPosicoesAntigas: vi.fn(resumir),
  };
}

describe("executarRetencaoGps", () => {
  it("resume cada viagem com posições antigas, com o corte de 90 dias", async () => {
    const d = deps(
      [
        [
          { orgId: 7, tripId: 1 },
          { orgId: 7, tripId: 2 },
        ],
        [],
      ],
      async () => ({ apagadas: 40, pontosResumo: 12 })
    );
    const r = await executarRetencaoGps(AGORA, d);
    expect(r).toEqual({ viagens: 2, ok: 2, falhas: 0, apagadas: 80 });
    expect(d.viagensComPosicoesAntigas).toHaveBeenCalledWith(CORTE, 200);
    expect(d.resumirEApagarPosicoesAntigas).toHaveBeenCalledWith(7, 1, CORTE);
  });

  it("uma viagem que falha não trava as outras (e é logada)", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps(
      [
        [
          { orgId: 7, tripId: 1 },
          { orgId: 7, tripId: 2 },
        ],
        [],
      ],
      async (_o, tripId) => {
        if (tripId === 1) throw new Error("deadlock");
        return { apagadas: 10, pontosResumo: 5 };
      }
    );
    const r = await executarRetencaoGps(AGORA, d);
    expect(r).toEqual({ viagens: 2, ok: 1, falhas: 1, apagadas: 10 });
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });

  it("viagem que falha SEMPRE não vira laço infinito", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // A consulta devolve sempre a mesma viagem (ela nunca é apagada).
    const d = deps([[{ orgId: 7, tripId: 9 }]], async () => {
      throw new Error("sempre falha");
    });
    const r = await executarRetencaoGps(AGORA, d);
    expect(r.falhas).toBe(1);
    expect(d.resumirEApagarPosicoesAntigas).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });

  it("nada a limpar → não faz nada", async () => {
    const d = deps([[]], async () => ({ apagadas: 0, pontosResumo: 0 }));
    const r = await executarRetencaoGps(AGORA, d);
    expect(r).toEqual({ viagens: 0, ok: 0, falhas: 0, apagadas: 0 });
    expect(d.resumirEApagarPosicoesAntigas).not.toHaveBeenCalled();
  });
});
