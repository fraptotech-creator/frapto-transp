import { describe, expect, it } from "vitest";
import { visivelParaMotorista } from "./_core/driverTrips";

describe("visivelParaMotorista", () => {
  it("mostra planejada e em_andamento", () => {
    expect(visivelParaMotorista({ status: "planejada" })).toBe(true);
    expect(visivelParaMotorista({ status: "em_andamento" })).toBe(true);
  });

  it("esconde concluída e cancelada", () => {
    expect(visivelParaMotorista({ status: "concluida" })).toBe(false);
    expect(visivelParaMotorista({ status: "cancelada" })).toBe(false);
  });

  it("esconde status desconhecido (fail-closed)", () => {
    expect(visivelParaMotorista({ status: "qualquer" })).toBe(false);
  });
});
