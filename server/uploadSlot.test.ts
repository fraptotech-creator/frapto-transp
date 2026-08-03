import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import { installUploadSlot, getUploadSlot } from "./_core/uploadSlot";
import { uploadSemaphore } from "./_core/concurrency";

function fakeReqRes() {
  const handlers: Record<string, () => void> = {};
  const req = { destroy: vi.fn() };
  const state = { code: 0, headersSent: false, body: null as unknown };
  const res = {
    locals: {},
    get headersSent() {
      return state.headersSent;
    },
    status(c: number) {
      state.code = c;
      state.headersSent = true;
      return res;
    },
    json(b: unknown) {
      state.body = b;
      return res;
    },
    on(ev: string, cb: () => void) {
      handlers[ev] = cb;
      return res;
    },
  } as unknown as Response;
  return { req, res, handlers, state };
}

// Timer injetável: captura a função para dispararmos o "timeout" na mão.
function fakeTimer() {
  const ref: { fn: (() => void) | null; cleared: boolean } = {
    fn: null,
    cleared: false,
  };
  const setTimer = (fn: () => void) => {
    ref.fn = fn;
    return {
      clear: () => {
        ref.cleared = true;
      },
    };
  };
  return { ref, setTimer };
}

const KEY = "upload:u1";
beforeEach(() => uploadSemaphore.reset());

describe("uploadSlot — slot desacoplado do socket (item 1)", () => {
  it("rede de segurança libera se a resposta FECHA antes de a op assumir", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    expect(uploadSemaphore.snapshot().global).toBe(1);
    const { req, res, handlers } = fakeReqRes();
    installUploadSlot(req, res, KEY, { setTimer: fakeTimer().setTimer });
    handlers.close(); // socket fechou durante o parsing (op não assumiu)
    expect(uploadSemaphore.snapshot().global).toBe(0); // liberou
  });

  it("op ASSUME o slot: finish/close NÃO liberam; só o release() da op", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    const { req, res, handlers } = fakeReqRes();
    const slot = installUploadSlot(req, res, KEY, {
      setTimer: fakeTimer().setTimer,
    });
    slot.claimOperation(); // operação pesada assumiu
    handlers.close(); // abort no meio da op → NÃO pode liberar
    expect(uploadSemaphore.snapshot().global).toBe(1); // slot MANTIDO
    slot.release(); // op assentou (finally)
    expect(uploadSemaphore.snapshot().global).toBe(0);
  });

  it("release é idempotente (exatamente uma vez)", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    const { req, res } = fakeReqRes();
    const slot = installUploadSlot(req, res, KEY, {
      setTimer: fakeTimer().setTimer,
    });
    slot.claimOperation();
    slot.release();
    slot.release(); // 2ª vez não faz nada
    expect(uploadSemaphore.snapshot().global).toBe(0);
    // e um acquire novo continua respeitando o teto (não virou negativo)
    expect(uploadSemaphore.acquire(KEY, 2, 10)).toBe(true);
    uploadSemaphore.reset();
  });

  it("timeout de leitura (op não assumiu): responde 408, destrói req e libera", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    const { req, res, state } = fakeReqRes();
    const timer = fakeTimer();
    installUploadSlot(req, res, KEY, { setTimer: timer.setTimer });
    timer.ref.fn?.(); // dispara o timeout
    expect(state.code).toBe(408);
    expect(req.destroy).toHaveBeenCalledOnce();
    expect(uploadSemaphore.snapshot().global).toBe(0);
  });

  it("timeout é limpo quando a op assume (não dispara depois)", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    const { req, res, state } = fakeReqRes();
    const timer = fakeTimer();
    const slot = installUploadSlot(req, res, KEY, { setTimer: timer.setTimer });
    slot.claimOperation();
    expect(timer.ref.cleared).toBe(true);
    timer.ref.fn?.(); // mesmo se disparasse, op já assumiu → não responde 408
    expect(state.code).toBe(0);
    expect(req.destroy).not.toHaveBeenCalled();
    slot.release();
  });

  it("getUploadSlot devolve o slot instalado", () => {
    uploadSemaphore.acquire(KEY, 2, 10);
    const { req, res } = fakeReqRes();
    const slot = installUploadSlot(req, res, KEY, {
      setTimer: fakeTimer().setTimer,
    });
    expect(getUploadSlot(res)).toBe(slot);
    slot.claimOperation();
    slot.release();
  });
});
