import { describe, it, expect, beforeEach } from "vitest";
import { assertCotaGeo, COTA_GEO_ENDERECOS } from "./routers/geo";
import { allowRequest, _resetRateLimit } from "./_core/rateLimit";

// Trava da auditoria pré-venda 23/11/2026: sem cota, uma empresa disparava
// centenas de consultas ao OpenStreetMap por chamada (rota com 25 paradas),
// arriscando o bloqueio do servidor lá — e a rota parando para todos.
describe("cota de geocodificação por empresa", () => {
  beforeEach(() => _resetRateLimit());

  it("conta ENDEREÇOS, não chamadas", () => {
    // 7 rotas com 25 paradas (27 endereços) = 189; a 8ª passa de 200.
    for (let i = 0; i < 7; i++) {
      expect(() => assertCotaGeo(1, 27)).not.toThrow();
    }
    expect(() => assertCotaGeo(1, 27)).toThrow(/Muitos cálculos de rota/);
    // Ainda cabem 11 endereços: rota simples segue funcionando.
    expect(() => assertCotaGeo(1, 2)).not.toThrow();
  });

  it("uma empresa no teto não afeta outra", () => {
    assertCotaGeo(1, COTA_GEO_ENDERECOS);
    expect(() => assertCotaGeo(1, 1)).toThrow();
    expect(() => assertCotaGeo(2, 2)).not.toThrow();
  });
});

describe("allowRequest com custo", () => {
  beforeEach(() => _resetRateLimit());

  it("custo 1 (padrão) mantém o comportamento antigo", () => {
    expect(allowRequest("k", 2, 1000, 0)).toBe(true);
    expect(allowRequest("k", 2, 1000, 0)).toBe(true);
    expect(allowRequest("k", 2, 1000, 0)).toBe(false);
  });

  it("chamada que não cabe inteira é negada e não consome nada", () => {
    expect(allowRequest("k", 10, 1000, 0, 8)).toBe(true);
    expect(allowRequest("k", 10, 1000, 0, 5)).toBe(false);
    expect(allowRequest("k", 10, 1000, 0, 2)).toBe(true);
  });

  it("a cota volta depois da janela", () => {
    expect(allowRequest("k", 3, 1000, 0, 3)).toBe(true);
    expect(allowRequest("k", 3, 1000, 500, 1)).toBe(false);
    expect(allowRequest("k", 3, 1000, 1001, 3)).toBe(true);
  });
});
