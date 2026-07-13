import { describe, expect, it } from "vitest";
import { canRecordPosition, speedMsToKmh } from "./_core/tracking";

describe("canRecordPosition", () => {
  const driverId = 7;

  it("grava quando a viagem é do motorista e está em andamento", () => {
    expect(
      canRecordPosition({ motoristaId: 7, status: "em_andamento" }, driverId)
    ).toBe(true);
  });

  it("NÃO grava viagem de outro motorista (isolamento)", () => {
    expect(
      canRecordPosition({ motoristaId: 99, status: "em_andamento" }, driverId)
    ).toBe(false);
  });

  it("NÃO grava se a viagem não está em andamento", () => {
    for (const status of ["planejada", "concluida", "cancelada"]) {
      expect(canRecordPosition({ motoristaId: 7, status }, driverId)).toBe(
        false
      );
    }
  });

  it("NÃO grava viagem inexistente/sem motorista", () => {
    expect(canRecordPosition(null, driverId)).toBe(false);
    expect(canRecordPosition(undefined, driverId)).toBe(false);
    expect(
      canRecordPosition({ motoristaId: null, status: "em_andamento" }, driverId)
    ).toBe(false);
  });
});

describe("speedMsToKmh", () => {
  it("converte m/s para km/h", () => {
    expect(speedMsToKmh(10)).toBe(36);
    expect(speedMsToKmh(27.78)).toBeCloseTo(100.01, 1);
  });

  it("trata ausência/invalidez como null", () => {
    expect(speedMsToKmh(null)).toBeNull();
    expect(speedMsToKmh(undefined)).toBeNull();
    expect(speedMsToKmh(NaN)).toBeNull();
    expect(speedMsToKmh(-5)).toBeNull();
  });
});
