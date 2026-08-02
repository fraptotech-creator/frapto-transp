import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mocks das dependências para exercitar a ORQUESTRAÇÃO da barreira.
const sdkMock = vi.hoisted(() => ({ verifySession: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));
const rl = vi.hoisted(() => ({ allowRequest: vi.fn() }));
vi.mock("./_core/rateLimit", () => rl);
const conc = vi.hoisted(() => ({ acquire: vi.fn(), release: vi.fn() }));
vi.mock("./_core/concurrency", () => conc);

import { uploadGate } from "./_core/uploadGate";

function fakeRes() {
  const r: {
    code: number;
    body: unknown;
    handlers: Record<string, () => void>;
  } = { code: 0, body: null, handlers: {} };
  const res = {
    status(c: number) {
      r.code = c;
      return res;
    },
    json(b: unknown) {
      r.body = b;
      return res;
    },
    on(ev: string, cb: () => void) {
      r.handlers[ev] = cb;
      return res;
    },
  } as unknown as Response;
  return { res, r };
}
const req = (cookie?: string) =>
  ({ headers: cookie ? { cookie } : {} }) as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
  sdkMock.verifySession.mockResolvedValue({
    openId: "u1",
    appId: "frapto-transp",
    name: "",
    sver: 0,
  });
  rl.allowRequest.mockReturnValue(true);
  conc.acquire.mockReturnValue(true);
});

describe("uploadGate — auth+throttle ANTES do parser (Lote 1)", () => {
  it("sessão inválida → 401 e NÃO chama next (parser não roda)", async () => {
    sdkMock.verifySession.mockResolvedValue(null);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req("frapto_session=lixo"), res, next);
    expect(r.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(conc.acquire).not.toHaveBeenCalled(); // nem chegou a reservar slot
  });

  it("sem cookie → 401 e NÃO chama next", async () => {
    sdkMock.verifySession.mockResolvedValue(null);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req(), res, next);
    expect(r.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rate-limit dedicado estourado → 429 e NÃO chama next", async () => {
    rl.allowRequest.mockReturnValue(false);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req("c=1"), res, next);
    expect(r.code).toBe(429);
    expect(next).not.toHaveBeenCalled();
    expect(conc.acquire).not.toHaveBeenCalled();
  });

  it("concorrência no teto → 429 e NÃO chama next", async () => {
    conc.acquire.mockReturnValue(false);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req("c=1"), res, next);
    expect(r.code).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("sessão válida + dentro dos limites → chama next e agenda release", async () => {
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req("c=1"), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(r.code).toBe(0); // nada negado
    expect(conc.acquire).toHaveBeenCalledOnce();
    // libera o slot ao término da resposta
    expect(r.handlers.finish).toBeTypeOf("function");
    r.handlers.finish();
    expect(conc.release).toHaveBeenCalledOnce();
  });

  it("chave de rate-limit/concorrência é POR usuário (openId)", async () => {
    const { res } = fakeRes();
    await uploadGate(req("c=1"), res, vi.fn());
    expect(rl.allowRequest).toHaveBeenCalledWith(
      "upload:u1",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(conc.acquire).toHaveBeenCalledWith(
      "upload:u1",
      expect.any(Number),
      expect.any(Number)
    );
  });
});
