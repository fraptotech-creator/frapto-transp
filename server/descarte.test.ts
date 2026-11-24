import { describe, it, expect } from "vitest";
import {
  precisaConfirmarDescarte,
  PERGUNTA_DESCARTE,
} from "../client/src/lib/descarte";

// Teste pré-venda 23/11/2026: "ABC" digitado no cadastro de veículo + Esc →
// o formulário fechou e reabriu vazio, sem perguntar.
describe("precisaConfirmarDescarte", () => {
  it("formulário protegido com algo preenchido → pergunta", () => {
    expect(precisaConfirmarDescarte(true, true)).toBe(true);
  });

  it("formulário protegido ainda intocado → fecha direto", () => {
    expect(precisaConfirmarDescarte(true, false)).toBe(false);
  });

  it("janela comum (não é formulário) → fecha direto", () => {
    expect(precisaConfirmarDescarte(false, true)).toBe(false);
  });

  it("a pergunta diz o que se perde", () => {
    expect(PERGUNTA_DESCARTE).toMatch(/serão perdidos/);
  });
});
