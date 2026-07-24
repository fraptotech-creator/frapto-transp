import { describe, expect, it } from "vitest";
import { accrueOdometerCore, type OdometerAccrual } from "./_core/odometer";

// Fake que modela o UPDATE condicional do banco: claim() é um compare-and-set
// ATÔMICO sobre a flag compartilhada (sem await entre checar e setar), igual
// ao `UPDATE ... WHERE aplicada=false` com trava de linha. Só o primeiro
// chamador vira false->true; os demais recebem false.
function fakeVeiculo() {
  const estado = { aplicada: false, km: 0, addKmCalls: 0 };
  const exec: OdometerAccrual = {
    async claim() {
      await Promise.resolve(); // ponto de troca de contexto ANTES do set
      if (estado.aplicada) return false;
      estado.aplicada = true; // set atômico (JS single-thread) = trava do UPDATE
      return true;
    },
    async addKm(km) {
      estado.addKmCalls++;
      estado.km += km;
    },
  };
  return { estado, exec };
}

describe("accrueOdometerCore", () => {
  it("soma o km uma vez quando reivindica", async () => {
    const { estado, exec } = fakeVeiculo();
    expect(await accrueOdometerCore(exec, 120)).toBe("aplicado");
    expect(estado.km).toBe(120);
    expect(estado.addKmCalls).toBe(1);
  });

  it("REPETIÇÃO não soma de novo (já aplicado)", async () => {
    const { estado, exec } = fakeVeiculo();
    await accrueOdometerCore(exec, 120);
    expect(await accrueOdometerCore(exec, 120)).toBe("ja-aplicado");
    expect(estado.km).toBe(120); // não dobrou
  });

  it("duas conclusões CONCORRENTES somam a distância só uma vez", async () => {
    // O bug real: dois cliques em "concluir" (ou updateStatus disparado 2x)
    // liam a flag false e ambos somavam. Aqui exigimos exatamente 1 soma.
    const { estado, exec } = fakeVeiculo();
    const r = await Promise.all([
      accrueOdometerCore(exec, 200),
      accrueOdometerCore(exec, 200),
    ]);
    expect(estado.addKmCalls).toBe(1);
    expect(estado.km).toBe(200);
    expect(r.filter(x => x === "aplicado")).toHaveLength(1);
    expect(r.filter(x => x === "ja-aplicado")).toHaveLength(1);
  });

  it("km <= 0 não reivindica nem soma", async () => {
    const { estado, exec } = fakeVeiculo();
    expect(await accrueOdometerCore(exec, 0)).toBe("sem-km");
    expect(estado.aplicada).toBe(false);
    expect(estado.addKmCalls).toBe(0);
  });
});
