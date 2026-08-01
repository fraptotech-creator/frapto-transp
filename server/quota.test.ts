import { describe, it, expect } from "vitest";
import { quotaExcedida, DOC_QUOTA_BYTES } from "./_core/quota";

describe("quotaExcedida (Lote 11 — quota R2 5 GB)", () => {
  it("dentro da quota → false", () => {
    expect(quotaExcedida(0, 1024)).toBe(false);
    expect(quotaExcedida(DOC_QUOTA_BYTES - 100, 100)).toBe(false); // enche exato
  });

  it("estoura a quota → true", () => {
    expect(quotaExcedida(DOC_QUOTA_BYTES, 1)).toBe(true);
    expect(quotaExcedida(DOC_QUOTA_BYTES - 50, 100)).toBe(true);
  });

  it("respeita quota customizada", () => {
    expect(quotaExcedida(900, 200, 1000)).toBe(true);
    expect(quotaExcedida(700, 200, 1000)).toBe(false);
  });

  it("valores inválidos → true (fail-closed)", () => {
    expect(quotaExcedida(NaN, 10)).toBe(true);
    expect(quotaExcedida(10, Infinity)).toBe(true);
    expect(quotaExcedida(-1, 10)).toBe(true);
  });

  it("DOC_QUOTA_BYTES = 5 GB", () => {
    expect(DOC_QUOTA_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });
});
