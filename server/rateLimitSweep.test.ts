import { describe, it, expect, beforeEach } from "vitest";
import { allowRequest, _resetRateLimit } from "./_core/rateLimit";

describe("allowRequest — janela e limpeza do Map (Lote 12)", () => {
  beforeEach(() => _resetRateLimit());

  it("respeita o limite dentro da janela e libera depois", () => {
    const t0 = 1_000_000;
    expect(allowRequest("k", 2, 1000, t0)).toBe(true);
    expect(allowRequest("k", 2, 1000, t0 + 10)).toBe(true);
    expect(allowRequest("k", 2, 1000, t0 + 20)).toBe(false); // estourou
    // após a janela, permite de novo
    expect(allowRequest("k", 2, 1000, t0 + 2000)).toBe(true);
  });

  it("chaves distintas não interferem", () => {
    const t = 5_000_000;
    expect(allowRequest("a", 1, 1000, t)).toBe(true);
    expect(allowRequest("a", 1, 1000, t + 1)).toBe(false);
    expect(allowRequest("b", 1, 1000, t + 1)).toBe(true); // outra chave, ok
  });

  it("sweep não afeta chave com hit recente", () => {
    const t = 9_000_000;
    expect(allowRequest("viva", 5, 1000, t)).toBe(true);
    // passa o intervalo de sweep (>5min) mas dentro de STALE — chave recente
    // (hit em t + ~6min) não é removida indevidamente.
    const t2 = t + 6 * 60 * 1000;
    expect(allowRequest("viva", 5, 1000, t2)).toBe(true);
  });
});
