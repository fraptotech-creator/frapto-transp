import { describe, it, expect } from "vitest";
import { isOilChange, computeOilStatus } from "./_core/oil";

describe("isOilChange", () => {
  it("reconhece variações de 'óleo' (com/sem acento, caixa)", () => {
    expect(isOilChange("Troca de óleo")).toBe(true);
    expect(isOilChange("troca de oleo")).toBe(true);
    expect(isOilChange("TROCA DE ÓLEO E FILTRO")).toBe(true);
  });
  it("não confunde outras manutenções", () => {
    expect(isOilChange("Revisão")).toBe(false);
    expect(isOilChange("Reparo de freio")).toBe(false);
    expect(isOilChange("")).toBe(false);
    expect(isOilChange(null)).toBe(false);
  });
});

describe("computeOilStatus", () => {
  it("ok quando ainda falta bastante", () => {
    const r = computeOilStatus({
      quilometragem: 12000,
      kmUltimaTrocaOleo: 10000,
      intervaloTrocaOleoKm: 10000,
    });
    expect(r.proximaTrocaKm).toBe(20000);
    expect(r.kmRestante).toBe(8000);
    expect(r.status).toBe("ok");
  });

  it("proxima quando falta ≤ 10% do intervalo", () => {
    const r = computeOilStatus({
      quilometragem: 19500,
      kmUltimaTrocaOleo: 10000,
      intervaloTrocaOleoKm: 10000,
    });
    expect(r.kmRestante).toBe(500);
    expect(r.status).toBe("proxima");
  });

  it("vencida quando passou do ponto (km restante negativo)", () => {
    const r = computeOilStatus({
      quilometragem: 21000,
      kmUltimaTrocaOleo: 10000,
      intervaloTrocaOleoKm: 10000,
    });
    expect(r.kmRestante).toBe(-1000);
    expect(r.status).toBe("vencida");
  });

  it("intervalo inválido/zero cai no padrão 10.000", () => {
    const r = computeOilStatus({
      quilometragem: 0,
      kmUltimaTrocaOleo: 0,
      intervaloTrocaOleoKm: 0,
    });
    expect(r.intervalo).toBe(10000);
    expect(r.proximaTrocaKm).toBe(10000);
    expect(r.status).toBe("ok");
  });
});
