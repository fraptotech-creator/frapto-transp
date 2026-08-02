import { describe, it, expect } from "vitest";
import { parseTrpcPath } from "./_core/trpcCanonical";

// URL original mínima só precisa conter o path (o %2F é checado ali).
const url = (p: string) => `/api/trpc${p}`;

describe("parseTrpcPath — canonicalização (Lote 1)", () => {
  it("path canônico de UMA procedure é aceito", () => {
    const r = parseTrpcPath("/documents.upload", url("/documents.upload"));
    expect(r).toEqual({ ok: true, proc: "documents.upload", batch: false });
    expect(parseTrpcPath("/auth.login", url("/auth.login")).ok).toBe(true);
    expect(parseTrpcPath("/vehicles.list", url("/vehicles.list")).ok).toBe(
      true
    );
  });

  it("alias com segmento extra (/x/documents.upload) é REJEITADO", () => {
    const r = parseTrpcPath("/x/documents.upload", url("/x/documents.upload"));
    expect(r.ok).toBe(false);
  });

  it("barra dupla (//documents.upload) é REJEITADA", () => {
    expect(
      parseTrpcPath("//documents.upload", url("//documents.upload")).ok
    ).toBe(false);
  });

  it("trailing slash é REJEITADO", () => {
    expect(
      parseTrpcPath("/documents.upload/", url("/documents.upload/")).ok
    ).toBe(false);
  });

  it("barra codificada (%2F) na URL original é REJEITADA", () => {
    // req.path pode vir decodificado; o %2F fica na originalUrl.
    expect(
      parseTrpcPath("/documents.upload", url("/documents.upload%2f..")).ok
    ).toBe(false);
    expect(
      parseTrpcPath("/documents%2Fupload", url("/documents%2Fupload")).ok
    ).toBe(false);
  });

  it("path vazio ou só a barra é REJEITADO", () => {
    expect(parseTrpcPath("/", url("/")).ok).toBe(false);
    expect(parseTrpcPath("", url("")).ok).toBe(false);
  });

  it("caracteres inválidos num único segmento são REJEITADOS", () => {
    expect(
      parseTrpcPath("/documents upload", url("/documents upload")).ok
    ).toBe(false);
    expect(
      parseTrpcPath("/documents;upload", url("/documents;upload")).ok
    ).toBe(false);
  });

  it("batch (vírgula) é SINALIZADO, não rejeitado (adapter faz o 400)", () => {
    const r = parseTrpcPath(
      "/documents.list,vehicles.list",
      url("/documents.list,vehicles.list?batch=1")
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.batch).toBe(true);
  });
});
