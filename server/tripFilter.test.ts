import { describe, expect, it } from "vitest";
import { filtrarPorStatus, combinaDataFiltro } from "@/lib/tripFilter";

const trips = [
  { id: 1, status: "planejada" },
  { id: 2, status: "em_andamento" },
  { id: 3, status: "concluida" },
  { id: 4, status: "cancelada" },
  { id: 5, status: "planejada" },
];

describe("filtrarPorStatus", () => {
  it("'todas' devolve tudo", () => {
    expect(filtrarPorStatus(trips, "todas")).toHaveLength(5);
  });

  it("filtra por cada status", () => {
    expect(filtrarPorStatus(trips, "planejada").map(t => t.id)).toEqual([1, 5]);
    expect(filtrarPorStatus(trips, "em_andamento").map(t => t.id)).toEqual([2]);
    expect(filtrarPorStatus(trips, "concluida").map(t => t.id)).toEqual([3]);
    expect(filtrarPorStatus(trips, "cancelada").map(t => t.id)).toEqual([4]);
  });

  it("não muta o array original", () => {
    const copia = [...trips];
    filtrarPorStatus(trips, "planejada");
    expect(trips).toEqual(copia);
  });
});

describe("combinaDataFiltro", () => {
  const ymd = "2026-06-15";
  it("sem filtros → passa", () => {
    expect(combinaDataFiltro(ymd, "", "")).toBe(true);
  });
  it("mês bate / não bate", () => {
    expect(combinaDataFiltro(ymd, "2026-06", "")).toBe(true);
    expect(combinaDataFiltro(ymd, "2026-07", "")).toBe(false);
  });
  it("data exata bate / não bate", () => {
    expect(combinaDataFiltro(ymd, "", "2026-06-15")).toBe(true);
    expect(combinaDataFiltro(ymd, "", "2026-06-16")).toBe(false);
  });
  it("mês + data combinados (AND)", () => {
    expect(combinaDataFiltro(ymd, "2026-06", "2026-06-15")).toBe(true);
    expect(combinaDataFiltro(ymd, "2026-07", "2026-06-15")).toBe(false);
  });
});
