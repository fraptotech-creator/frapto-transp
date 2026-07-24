import { describe, it, expect } from "vitest";
import {
  transicaoValida,
  estadoTerminal,
  type TripStatus,
} from "./_core/tripState";

const TODOS: TripStatus[] = [
  "planejada",
  "em_andamento",
  "concluida",
  "cancelada",
];

describe("transicaoValida", () => {
  it("permite o fluxo normal", () => {
    expect(transicaoValida("planejada", "em_andamento")).toBe(true);
    expect(transicaoValida("em_andamento", "concluida")).toBe(true);
  });

  it("permite cancelar de planejada e de em_andamento", () => {
    expect(transicaoValida("planejada", "cancelada")).toBe(true);
    expect(transicaoValida("em_andamento", "cancelada")).toBe(true);
  });

  it("permite no-op (same-state) para editar outros campos", () => {
    for (const s of TODOS) expect(transicaoValida(s, s), s).toBe(true);
  });

  it("BLOQUEIA pular etapa (planejada → concluida)", () => {
    expect(transicaoValida("planejada", "concluida")).toBe(false);
  });

  it("BLOQUEIA reabrir viagem concluída", () => {
    expect(transicaoValida("concluida", "em_andamento")).toBe(false);
    expect(transicaoValida("concluida", "planejada")).toBe(false);
    expect(transicaoValida("concluida", "cancelada")).toBe(false);
  });

  it("BLOQUEIA ressuscitar viagem cancelada", () => {
    expect(transicaoValida("cancelada", "planejada")).toBe(false);
    expect(transicaoValida("cancelada", "em_andamento")).toBe(false);
    expect(transicaoValida("cancelada", "concluida")).toBe(false);
  });

  it("BLOQUEIA voltar em_andamento → planejada", () => {
    expect(transicaoValida("em_andamento", "planejada")).toBe(false);
  });
});

describe("estadoTerminal", () => {
  it("concluida e cancelada são terminais", () => {
    expect(estadoTerminal("concluida")).toBe(true);
    expect(estadoTerminal("cancelada")).toBe(true);
  });
  it("planejada e em_andamento não são", () => {
    expect(estadoTerminal("planejada")).toBe(false);
    expect(estadoTerminal("em_andamento")).toBe(false);
  });
});
