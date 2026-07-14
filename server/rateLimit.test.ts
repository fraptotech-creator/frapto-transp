import { describe, expect, it, beforeEach } from "vitest";
import { allowRequest, _resetRateLimit } from "./_core/rateLimit";

describe("allowRequest (janela deslizante)", () => {
  beforeEach(() => _resetRateLimit());

  it("permite até o limite e bloqueia o excedente", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(allowRequest("k", 3, 60_000, t)).toBe(true);
    }
    expect(allowRequest("k", 3, 60_000, t)).toBe(false);
  });

  it("libera de novo quando a janela passa", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) allowRequest("k", 3, 60_000, t);
    expect(allowRequest("k", 3, 60_000, t)).toBe(false);
    // 61s depois → janela renova
    expect(allowRequest("k", 3, 60_000, t + 61_000)).toBe(true);
  });

  it("isola chaves diferentes (empresas distintas)", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) allowRequest("orgA", 3, 60_000, t);
    expect(allowRequest("orgA", 3, 60_000, t)).toBe(false);
    expect(allowRequest("orgB", 3, 60_000, t)).toBe(true);
  });
});
