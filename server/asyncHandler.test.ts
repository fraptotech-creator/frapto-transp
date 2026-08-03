import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./_core/asyncHandler";

const req = {} as Request;
const res = {} as Response;

describe("asyncHandler — rejeição async vira next(error) (item 2)", () => {
  it("encaminha a rejeição para next(error)", async () => {
    const boom = new Error("db down");
    const next = vi.fn() as unknown as NextFunction;
    asyncHandler(async () => {
      throw boom;
    })(req, res, next);
    // deixa o microtask do .catch rodar
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(boom);
  });

  it("sucesso não chama next(error)", async () => {
    const next = vi.fn() as unknown as NextFunction;
    asyncHandler(async (_q, _s, n) => {
      n(); // segue a cadeia normalmente
    })(req, res, next);
    await Promise.resolve();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // sem erro
  });
});
