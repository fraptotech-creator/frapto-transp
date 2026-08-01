import { describe, it, expect } from "vitest";
import { acquire, release } from "./_core/concurrency";

describe("concurrency semaphore (Lote 11 — IA)", () => {
  it("respeita o teto POR CHAVE e libera no release", () => {
    const k = "org:1";
    expect(acquire(k, 2, 100)).toBe(true);
    expect(acquire(k, 2, 100)).toBe(true);
    expect(acquire(k, 2, 100)).toBe(false); // 3ª estoura o perKey=2
    release(k);
    expect(acquire(k, 2, 100)).toBe(true); // liberou um slot
    release(k);
    release(k);
  });

  it("respeita o teto GLOBAL independente da chave", () => {
    expect(acquire("a", 5, 2)).toBe(true);
    expect(acquire("b", 5, 2)).toBe(true);
    expect(acquire("c", 5, 2)).toBe(false); // global=2 já cheio
    release("a");
    release("b");
  });

  it("release a mais não fica negativo (não abre slots fantasma)", () => {
    release("z"); // release sem acquire — não deve quebrar nem creditar
    expect(acquire("z", 1, 1)).toBe(true);
    release("z");
  });
});
