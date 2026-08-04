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

  it("query que NUNCA resolve + timeout + TTL + novas sondas → 1 query física", async () => {
    const c = clock();
    let calls = 0;
    const r = createReadiness({
      runQuery: () => {
        calls++;
        return new Promise(() => {}); // nunca resolve nem rejeita
      },
      now: c.now,
      timeoutMs: 20,
      cacheTtlMs: 100,
    });
    const burst = await Promise.all(
      Array.from({ length: 50 }, () => r.check())
    );
    expect(burst.every(x => x === false)).toBe(true); // 503 (timeout)
    // avança além do TTL e sonda de novo — NÃO pode abrir 2ª query física
    c.advance(500);
    expect(await r.check()).toBe(false);
    expect(await r.check()).toBe(false);
    expect(calls).toBe(1); // a query pendente é reusada; jamais uma segunda
  });

  it("erro do banco → 503 sem detalhes (false)", async () => {
    const c = clock();
    const r = createReadiness({
      runQuery: async () => {
        throw new Error("ECONNREFUSED host=segredo");
      },
      now: c.now,
      cacheTtlMs: 1000,
    });
    expect(await r.check()).toBe(false); // boolean, sem vazar a causa
  });

  it("ao ENCERRAR a query (reject) e recuperar o banco, volta a 200", async () => {
    const c = clock();
    let mode: "hang-then-reject" | "ok" = "hang-then-reject";
    let rejectFirst: (() => void) | null = null;
    const r = createReadiness({
      runQuery: () => {
        if (mode === "ok") return Promise.resolve([]);
        return new Promise((_res, rej) => {
          rejectFirst = () => rej(new Error("cancelada"));
        });
      },
      now: c.now,
      timeoutMs: 20,
      cacheTtlMs: 100,
    });
    expect(await r.check()).toBe(false); // pendente → 503
    rejectFirst?.(); // a query física é encerrada (cancelada/erro)
    await Promise.resolve();
    await Promise.resolve();
    mode = "ok";
    c.advance(500); // além do TTL
    expect(await r.check()).toBe(true); // nova query física → 200
  });
});
