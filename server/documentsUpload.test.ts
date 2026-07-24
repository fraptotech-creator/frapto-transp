import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Storage real de constantes (allowlist/limite), mas efeitos (put/db) mockados.
const storage = vi.hoisted(() => ({
  isStorageConfigured: vi.fn(() => true),
  putObject: vi.fn(async () => undefined),
  buildObjectKey: vi.fn(() => "orgs/1/k"),
  getDownloadUrl: vi.fn(),
  getViewUrl: vi.fn(),
  deleteObject: vi.fn(),
  ALLOWED_DOC_MIME: new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  MAX_DOC_BYTES: 10 * 1024 * 1024,
}));
vi.mock("./_core/storage", () => storage);

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getOrganization: vi
      .fn()
      .mockResolvedValue({ id: 1, subscriptionStatus: "active" }),
    createDocument: vi.fn(async () => ({ id: 1 })),
  };
});

const ctx = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "u",
    orgId: 1,
    orgRole: "owner",
    passwordHash: null,
    email: "a@b.com",
    name: "A",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as never,
  res: {} as never,
});

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0];

describe("documents.upload — MIME por conteúdo (P2 #11)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  beforeEach(() => {
    vi.clearAllMocks();
    caller = appRouter.createCaller(ctx());
  });

  it("REJEITA HTML disfarçado de image/png e NÃO grava no storage", async () => {
    await expect(
      caller.documents.upload({
        fileName: "x.png",
        contentType: "image/png", // mentira do cliente
        dataBase64: Buffer.from("<script>alert(1)</script>").toString("base64"),
        tipo: "outro",
      })
    ).rejects.toThrow(/não corresponde/i);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("aceita PNG real e grava com o tipo DETECTADO", async () => {
    await caller.documents.upload({
      fileName: "x.png",
      contentType: "image/png",
      dataBase64: b64(PNG),
      tipo: "outro",
    });
    expect(storage.putObject).toHaveBeenCalledOnce();
    // 3º arg = contentType usado no put: o detectado, não o declarado.
    expect(storage.putObject.mock.calls[0][2]).toBe("image/png");
  });
});
