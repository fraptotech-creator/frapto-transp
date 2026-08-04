import { describe, it, expect } from "vitest";
import { checkReady, createReadiness } from "./_core/health";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("checkReady — readiness do banco (item 4)", () => {
  it("banco saudável (SELECT 1 resolve) → pronto", async () => {
    expect(await checkReady(async () => [{ 1: 1 }], 1000)).toBe(true);
  });

  it("banco indisponível (SELECT 1 rejeita) → NÃO pronto", async () => {
    expect(
      await checkReady(async () => {
        throw new Error("ECONNREFUSED");
      }, 1000)
    ).toBe(false);
  });

  it("banco lento além do timeout → NÃO pronto (fail-closed)", async () => {
    // runQuery nunca resolve; o timeout curto vence → false.
    expect(await checkReady(() => new Promise(() => {}), 20)).toBe(false);
  });
});

describe("createReadiness — resistente a carga (item 5)", () => {
  it("100 sondas simultâneas executam NO MÁXIMO uma consulta (single-flight)", async () => {
    const c = clock();
    let calls = 0;
    const r = createReadiness({
      runQuery: async () => {
        calls++;
        return [];
      },
      now: c.now,
      timeoutMs: 1000,
      cacheTtlMs: 1500,
    });
    const results = await Promise.all(
      Array.from({ length: 100 }, () => r.check())
    );
    expect(calls).toBe(1);
    expect(results.every(x => x === true)).toBe(true);
  });

  it("cache curto: sondas dentro do TTL não abrem nova consulta", async () => {
    const c = clock();
    let calls = 0;
    const r = createReadiness({
      runQuery: async () => {
        calls++;
        return [];
      },
      now: c.now,
      cacheTtlMs: 1500,
    });
    await r.check();
    await r.check();
    expect(calls).toBe(1); // 2ª veio do cache
    c.advance(2000); // expira o cache
    await r.check();
    expect(calls).toBe(2);
  });

  it("banco lento → 503 (false) e NÃO acumula consultas pendentes", async () => {
    const c = clock();
    let calls = 0;
    const r = createReadiness({
      runQuery: () => {
        calls++;
        return new Promise(() => {}); // nunca resolve
      },
      now: c.now,
      timeoutMs: 20,
      cacheTtlMs: 1500,
    });
    const results = await Promise.all(
      Array.from({ length: 50 }, () => r.check())
    );
    expect(results.every(x => x === false)).toBe(true);
    expect(calls).toBe(1); // single-flight: uma só consulta pendente, não 50
  });

  it("após recuperação do banco, volta a 200 (true)", async () => {
    const c = clock();
    let ok = false;
    const r = createReadiness({
      runQuery: async () => {
        if (!ok) throw new Error("down");
        return [];
      },
      now: c.now,
      cacheTtlMs: 1000,
    });
    expect(await r.check()).toBe(false);
    ok = true;
    c.advance(1500); // expira o cache do estado ruim
    expect(await r.check()).toBe(true);
  });
});
