import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";

const sdkMock = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));

import { createContext } from "./_core/context";
import { grantUploadCapability } from "./_core/uploadCapability";

const user = (openId: string) =>
  ({ openId, sessionVersion: 0 }) as unknown as User;

function opts(res: Response) {
  return {
    req: { headers: {} } as unknown as Request,
    res,
  } as unknown as Parameters<typeof createContext>[0];
}

beforeEach(() => vi.clearAllMocks());

describe("createContext — reuso do usuário validado pela barreira (Lote 1)", () => {
  it("com usuário na barreira (res.locals): REUSA e NÃO re-consulta o banco", async () => {
    const res = { locals: {} } as unknown as Response;
    const u = user("upl");
    grantUploadCapability(res, u);
    const ctx = await createContext(opts(res));
    expect(ctx.user).toBe(u);
    // não chama a autenticação de novo (sem consulta duplicada)
    expect(sdkMock.authenticateRequest).not.toHaveBeenCalled();
  });

  it("sem marca da barreira: autentica normalmente via sdk", async () => {
    const res = { locals: {} } as unknown as Response;
    const u = user("normal");
    sdkMock.authenticateRequest.mockResolvedValue(u);
    const ctx = await createContext(opts(res));
    expect(ctx.user).toBe(u);
    expect(sdkMock.authenticateRequest).toHaveBeenCalledOnce();
  });

  it("sem marca e autenticação falha: user = null (procedures públicas)", async () => {
    const res = { locals: {} } as unknown as Response;
    sdkMock.authenticateRequest.mockRejectedValue(new Error("sem sessão"));
    const ctx = await createContext(opts(res));
    expect(ctx.user).toBeNull();
  });
});
