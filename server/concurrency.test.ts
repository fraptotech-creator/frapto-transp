import { describe, it, expect } from "vitest";
import {
  createSemaphore,
  uploadSemaphore,
  aiSemaphore,
} from "./_core/concurrency";

describe("semáforo de concorrência", () => {
  it("respeita o teto POR CHAVE e libera no release", () => {
    const s = createSemaphore();
    const k = "org:1";
    expect(s.acquire(k, 2, 100)).toBe(true);
    expect(s.acquire(k, 2, 100)).toBe(true);
    expect(s.acquire(k, 2, 100)).toBe(false); // 3ª estoura o perKey=2
    s.release(k);
    expect(s.acquire(k, 2, 100)).toBe(true); // liberou um slot
    s.release(k);
    s.release(k);
  });

  it("respeita o teto GLOBAL independente da chave", () => {
    const s = createSemaphore();
    expect(s.acquire("a", 5, 2)).toBe(true);
    expect(s.acquire("b", 5, 2)).toBe(true);
    expect(s.acquire("c", 5, 2)).toBe(false); // global=2 já cheio
    s.release("a");
    s.release("b");
  });

  it("release a mais não fica negativo (não abre slots fantasma)", () => {
    const s = createSemaphore();
    s.release("z"); // release sem acquire — não deve quebrar nem creditar
    expect(s.acquire("z", 1, 1)).toBe(true);
    s.release("z");
  });

  it("pools upload e IA são INDEPENDENTES (teto global separado)", () => {
    uploadSemaphore.reset();
    aiSemaphore.reset();
    // Enche o teto global do upload (10). O da IA NÃO deve ser afetado.
    for (let i = 0; i < 10; i++) {
      expect(uploadSemaphore.acquire(`u${i}`, 2, 10)).toBe(true);
    }
    expect(uploadSemaphore.acquire("u10", 2, 10)).toBe(false); // upload cheio
    expect(aiSemaphore.acquire("ai:1", 3, 20)).toBe(true); // IA intacta
    uploadSemaphore.reset();
    aiSemaphore.reset();
  });
});
