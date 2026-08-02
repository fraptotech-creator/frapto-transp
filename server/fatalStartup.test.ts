import { describe, it, expect, vi } from "vitest";
import { reportFatalStartup } from "./_core/fatalStartup";
import { decideBoot } from "./_core/bootGuard";

describe("reportFatalStartup — boot fatal encerra != 0 (Lote 4)", () => {
  it("define exitCode = 1 e loga a mensagem", () => {
    const log = vi.fn();
    const setExitCode = vi.fn();
    reportFatalStartup(new Error("config inválida: NODE_ENV ausente"), {
      log,
      setExitCode,
    });
    expect(setExitCode).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("NODE_ENV ausente");
  });

  it("NÃO vaza cause/stack — só a mensagem curada", () => {
    const log = vi.fn();
    const setExitCode = vi.fn();
    const err = Object.assign(new Error("problema de boot"), {
      cause: { code: "ER", segredo: "sk_live_NAO_PODE_VAZAR" },
      stack: "at /app/dist secret=sk_live_NAO_PODE_VAZAR",
    });
    reportFatalStartup(err, { log, setExitCode });
    const out = log.mock.calls.map(c => c[0]).join("\n");
    expect(out).not.toContain("sk_live_NAO_PODE_VAZAR");
    expect(out).toContain("problema de boot");
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("erro não-Error (string) também encerra != 0", () => {
    const setExitCode = vi.fn();
    reportFatalStartup("falha crua", { log: vi.fn(), setExitCode });
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  // Integração com o guard: os ambientes que o guard REJEITA (Lote D) produzem
  // um throw → reportFatalStartup encerra != 0. Aqui ligamos as duas pontas.
  it("Railway + NODE_ENV ausente: guard nega → encerraria != 0", () => {
    const d = decideBoot({
      nodeEnv: undefined,
      onRailway: true,
      jwtSecretLen: 44,
      hasDatabaseUrl: true,
      hasAppBaseUrl: true,
      aiKeyBytes: 32,
    });
    expect(d.ok).toBe(false);
    const setExitCode = vi.fn();
    // simula o fluxo do startServer: guard falho → throw → catch(reportFatal)
    if (!d.ok) {
      reportFatalStartup(new Error(d.problems.join("; ")), {
        log: vi.fn(),
        setExitCode,
      });
    }
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it("config válida: guard aprova → NÃO encerra (nenhum fatal)", () => {
    const d = decideBoot({
      nodeEnv: "production",
      onRailway: true,
      jwtSecretLen: 44,
      hasDatabaseUrl: true,
      hasAppBaseUrl: true,
      aiKeyBytes: 32,
    });
    expect(d).toEqual({ ok: true, mode: "production" });
    // sem throw → reportFatalStartup nunca é chamado → exitCode fica 0 (default)
  });
});
