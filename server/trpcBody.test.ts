import { describe, it, expect } from "vitest";
import { isTrpcUploadPath } from "./_core/trpcBody";

describe("isTrpcUploadPath — só o upload leva parser grande (Lote C)", () => {
  it("documents.upload usa o parser grande", () => {
    expect(isTrpcUploadPath("/documents.upload")).toBe(true);
  });

  it("procedures comuns usam o parser pequeno", () => {
    for (const p of [
      "/auth.me",
      "/auth.login",
      "/documents.list",
      "/documents.delete",
      "/trips.create",
      "/ai.chat",
    ]) {
      expect(isTrpcUploadPath(p), p).toBe(false);
    }
  });

  it("não casa por prefixo/sufixo (match exato)", () => {
    expect(isTrpcUploadPath("/documents.upload.x")).toBe(false);
    expect(isTrpcUploadPath("/x/documents.upload")).toBe(false);
    expect(isTrpcUploadPath("")).toBe(false);
  });
});
