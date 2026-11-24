import { describe, it, expect } from "vitest";
import { filtrarVeiculos, rotuloVeiculo } from "../client/src/lib/buscaVeiculo";

// Teste pré-venda 23/11/2026: seletor de veículo sem busca (57 veículos).
const frota = [
  { id: 1, placa: "ABC1234", marca: "Volvo", modelo: "FH 540" },
  { id: 2, placa: "RQE4F21", marca: "Mercedes-Benz", modelo: "Sprinter" },
  { id: 3, placa: "XYZ9876", marca: "Citroën", modelo: "Jumper" },
  { id: 4, placa: "QWE1A11", marca: null, modelo: null },
];
const ids = (termo: string) => filtrarVeiculos(frota, termo).map(v => v.id);

describe("filtrarVeiculos", () => {
  it("busca vazia devolve todos, na mesma ordem", () => {
    expect(ids("")).toEqual([1, 2, 3, 4]);
    expect(ids("   ")).toEqual([1, 2, 3, 4]);
  });

  it("placa com ou sem hífen/espaço, maiúscula ou minúscula", () => {
    expect(ids("abc1234")).toEqual([1]);
    expect(ids("ABC-1234")).toEqual([1]);
    expect(ids("abc 1234")).toEqual([1]);
    expect(ids("4f2")).toEqual([2]);
  });

  it("marca/modelo sem acento acha o nome com acento", () => {
    expect(ids("citroen")).toEqual([3]);
    expect(ids("sprinter")).toEqual([2]);
  });

  it("várias palavras em qualquer ordem: todas precisam bater", () => {
    expect(ids("1234 volvo")).toEqual([1]);
    expect(ids("volvo sprinter")).toEqual([]);
  });

  it("veículo sem marca/modelo continua achável pela placa", () => {
    expect(ids("qwe1a")).toEqual([4]);
  });
});

describe("rotuloVeiculo", () => {
  it("placa formatada + marca e modelo", () => {
    expect(rotuloVeiculo(frota[0])).toBe("ABC-1234 — Volvo FH 540");
  });
  it("sem marca/modelo mostra só a placa", () => {
    expect(rotuloVeiculo(frota[3])).toBe("QWE1A11");
  });
});
