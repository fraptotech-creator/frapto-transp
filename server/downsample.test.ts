import { describe, it, expect } from "vitest";
import { downsampleEvenly } from "./_core/tracking";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("downsampleEvenly", () => {
  it("não mexe quando já cabe no limite", () => {
    expect(downsampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(downsampleEvenly([], 5)).toEqual([]);
  });

  it("reduz para exatamente `max` itens", () => {
    expect(downsampleEvenly(range(1000), 100)).toHaveLength(100);
  });

  it("SEMPRE preserva o primeiro e o último (traçado fecha nas pontas)", () => {
    const out = downsampleEvenly(range(1000), 50);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
  });

  it("amostra por igual (índices crescentes, sem repetir em bloco)", () => {
    const out = downsampleEvenly(range(100), 10);
    // Monótono crescente e cobrindo toda a extensão.
    for (let i = 1; i < out.length; i++)
      expect(out[i]).toBeGreaterThan(out[i - 1]);
    expect(out[out.length - 1]).toBe(99);
  });

  it("casos-limite: max<=0 → vazio; max=1 → só o último", () => {
    expect(downsampleEvenly(range(10), 0)).toEqual([]);
    expect(downsampleEvenly(range(10), 1)).toEqual([9]);
  });
});
