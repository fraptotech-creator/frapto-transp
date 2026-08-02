import { describe, it, expect, vi } from "vitest";
import { createShutdownHandler } from "./_core/shutdown";

// server.close falso: guarda o callback para dispararmos quando quisermos.
function fakeServer() {
  let cb: (() => void) | null = null;
  return {
    close: vi.fn((c?: () => void) => {
      cb = c ?? null;
    }),
    finish: () => cb?.(),
  };
}

describe("createShutdownHandler — encerramento gracioso (melhoria)", () => {
  it("fecha o servidor e sai 0 quando as conexões drenam", () => {
    const server = fakeServer();
    const exit = vi.fn();
    const setTimer = vi.fn(() => ({ unref: vi.fn() }));
    const handler = createShutdownHandler(server, {
      exit,
      setTimer,
      log: vi.fn(),
    });
    handler();
    expect(server.close).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled(); // ainda drenando
    server.finish(); // conexões drenaram
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("é IDEMPOTENTE: sinais repetidos não fecham duas vezes", () => {
    const server = fakeServer();
    const handler = createShutdownHandler(server, {
      exit: vi.fn(),
      setTimer: () => ({ unref: vi.fn() }),
      log: vi.fn(),
    });
    handler();
    handler();
    handler();
    expect(server.close).toHaveBeenCalledOnce();
  });

  it("timeout de segurança força saída 1 se o close travar", () => {
    const server = fakeServer(); // nunca chama o callback (close travado)
    const exit = vi.fn();
    let timerFn: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      timerFn = fn;
      return { unref: vi.fn() };
    });
    const handler = createShutdownHandler(server, {
      exit,
      setTimer,
      log: vi.fn(),
      timeoutMs: 5000,
    });
    handler();
    expect(exit).not.toHaveBeenCalled();
    timerFn?.(); // dispara o timeout
    expect(exit).toHaveBeenCalledWith(1);
  });
});
