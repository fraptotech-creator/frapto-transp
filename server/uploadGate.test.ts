import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mocks das dependências de EFEITO; a lógica de capacidade (res.locals) é REAL.
const sdkMock = vi.hoisted(() => ({ validateActiveSession: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));
const rl = vi.hoisted(() => ({ allowRequest: vi.fn() }));
vi.mock("./_core/rateLimit", () => rl);
const conc = vi.hoisted(() => ({ acquire: vi.fn(), release: vi.fn() }));
vi.mock("./_core/concurrency", () => conc);

import { uploadGate } from "./_core/uploadGate";
import {
  setTrpcProc,
  hasUploadCapability,
  getGateUser,
  UPLOAD_PROC,
} from "./_core/uploadCapability";

function fakeRes(proc: string | null = UPLOAD_PROC) {
  const r: {
    code: number;
    body: unknown;
    handlers: Record<string, () => void>;
  } = { code: 0, body: null, handlers: {} };
  const res = {
    locals: {},
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
  if (proc) setTrpcProc(res, proc);
  return { res, r };
}
const req = (opts: { cookie?: string; method?: string; ip?: string } = {}) =>
  ({
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    method: opts.method ?? "POST",
    ip: opts.ip ?? "1.2.3.4",
  }) as unknown as Request;

const activeUser = {
  openId: "u1",
  sessionVersion: 0,
} as unknown as import("../drizzle/schema").User;

beforeEach(() => {
  vi.clearAllMocks();
  sdkMock.validateActiveSession.mockResolvedValue(activeUser);
  rl.allowRequest.mockReturnValue(true);
  conc.acquire.mockReturnValue(true);
});

describe("uploadGate — barreira fail-closed do upload (Lote 1)", () => {
  it("procedure NÃO-upload segue direto (next), sem autenticar nem limitar", async () => {
    const { res, r } = fakeRes("vehicles.list");
    const next = vi.fn();
    await uploadGate(req(), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(r.code).toBe(0);
    expect(sdkMock.validateActiveSession).not.toHaveBeenCalled();
    expect(rl.allowRequest).not.toHaveBeenCalled();
    expect(hasUploadCapability(res)).toBe(false);
  });

  it("backstop por IP estourado → 429 ANTES de autenticar (sem next, sem sessão)", async () => {
    rl.allowRequest.mockReturnValueOnce(false); // 1ª chamada = backstop IP
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req({ cookie: "x=1" }), res, next);
    expect(r.code).toBe(429);
    expect(next).not.toHaveBeenCalled();
    expect(sdkMock.validateActiveSession).not.toHaveBeenCalled();
  });

  it("método diferente de POST → 405 ANTES de qualquer parser (sem next)", async () => {
    for (const method of ["PUT", "PATCH", "DELETE", "GET"]) {
      const { res, r } = fakeRes();
      const next = vi.fn();
      await uploadGate(req({ method, cookie: "c=1" }), res, next);
      expect(r.code, method).toBe(405);
      expect(next, method).not.toHaveBeenCalled();
      expect(hasUploadCapability(res), method).toBe(false);
    }
  });

  it("sessão inativa (revogada/usuário sumido/sver) → 401 sem next nem capacidade", async () => {
    sdkMock.validateActiveSession.mockResolvedValue(null);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req({ cookie: "frapto_session=lixo" }), res, next);
    expect(r.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(conc.acquire).not.toHaveBeenCalled();
    expect(hasUploadCapability(res)).toBe(false);
  });

  it("sem cookie → 401 (validateActiveSession recebe undefined)", async () => {
    sdkMock.validateActiveSession.mockResolvedValue(null);
    const { res, r } = fakeRes();
    await uploadGate(req(), res, vi.fn());
    expect(r.code).toBe(401);
    expect(sdkMock.validateActiveSession).toHaveBeenCalledWith(undefined);
  });

  it("rate-limit por usuário estourado → 429 sem next", async () => {
    rl.allowRequest
      .mockReturnValueOnce(true) // backstop IP
      .mockReturnValueOnce(false); // limite por usuário
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req({ cookie: "c=1" }), res, next);
    expect(r.code).toBe(429);
    expect(next).not.toHaveBeenCalled();
    expect(conc.acquire).not.toHaveBeenCalled();
  });

  it("concorrência no teto → 429 sem next", async () => {
    conc.acquire.mockReturnValue(false);
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req({ cookie: "c=1" }), res, next);
    expect(r.code).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("sessão ATIVA + limites ok → concede capacidade, guarda usuário, next e agenda release", async () => {
    const { res, r } = fakeRes();
    const next = vi.fn();
    await uploadGate(req({ cookie: "c=1" }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(r.code).toBe(0);
    expect(hasUploadCapability(res)).toBe(true);
    expect(getGateUser(res)).toBe(activeUser);
    expect(conc.acquire).toHaveBeenCalledOnce();
    // libera o slot ao término da resposta (finish) e também no close.
    expect(r.handlers.finish).toBeTypeOf("function");
    expect(r.handlers.close).toBeTypeOf("function");
    r.handlers.finish();
    r.handlers.close(); // idempotente: não libera duas vezes
    expect(conc.release).toHaveBeenCalledOnce();
  });

  it("chaves de rate-limit/concorrência são POR usuário; backstop é por IP", async () => {
    const { res } = fakeRes();
    await uploadGate(req({ cookie: "c=1", ip: "9.9.9.9" }), res, vi.fn());
    expect(rl.allowRequest).toHaveBeenNthCalledWith(
      1,
      "upload-ip:9.9.9.9",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(rl.allowRequest).toHaveBeenNthCalledWith(
      2,
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
