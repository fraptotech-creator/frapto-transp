import { describe, it, expect } from "vitest";
import { tripKmToAccrue } from "./_core/odometer";

const base = {
  status: "concluida",
  distancia: "150.00",
  quilometragemAplicada: false,
  veiculoId: 5,
};

describe("tripKmToAccrue", () => {
  it("viagem concluída, não aplicada, com distância → soma (arredonda)", () => {
    expect(tripKmToAccrue(base)).toBe(150);
    expect(tripKmToAccrue({ ...base, distancia: "149.6" })).toBe(150);
  });

  it("não conta em dobro se já aplicada", () => {
    expect(tripKmToAccrue({ ...base, quilometragemAplicada: true })).toBe(0);
  });

  it("só soma quando status = concluida", () => {
    for (const status of ["planejada", "em_andamento", "cancelada"]) {
      expect(tripKmToAccrue({ ...base, status })).toBe(0);
    }
  });

  it("sem distância / distância zero ou negativa → 0", () => {
    expect(tripKmToAccrue({ ...base, distancia: null })).toBe(0);
    expect(tripKmToAccrue({ ...base, distancia: "0" })).toBe(0);
    expect(tripKmToAccrue({ ...base, distancia: "-10" })).toBe(0);
  });

  it("sem veículo → 0", () => {
    expect(tripKmToAccrue({ ...base, veiculoId: null })).toBe(0);
  });
});
