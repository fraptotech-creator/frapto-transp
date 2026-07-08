import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { activeOrgProcedure, router } from "../_core/trpc";
import {
  getDocuments,
  getDocumentById,
  createDocument,
  deleteDocument,
} from "../db";
import {
  putObject,
  getDownloadUrl,
  deleteObject,
  buildObjectKey,
  ALLOWED_DOC_MIME,
  MAX_DOC_BYTES,
  isStorageConfigured,
} from "../_core/storage";
import { assertRefsOwned } from "./_helpers";

// Documentos (upload em R2), isolado por organização.
export const documentsRouter = router({
  status: activeOrgProcedure.query(() => ({
    configured: isStorageConfigured(),
  })),

  list: activeOrgProcedure.query(({ ctx }) => getDocuments(ctx.orgId)),

  upload: activeOrgProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1),
        dataBase64: z.string().min(1),
        tipo: z.enum(["crlv", "seguro", "cnh", "rg", "cpf", "outro"]),
        descricao: z.string().max(150).optional(),
        veiculoId: z.number().optional(),
        motoristId: z.number().optional(),
        dataVencimento: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Armazenamento de arquivos não configurado.",
        });
      }
      // Trava de MIME (bloqueia svg/html/js → XSS servido pelo CDN).
      if (!ALLOWED_DOC_MIME.has(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tipo de arquivo não permitido (use PDF, JPG, PNG ou WEBP).",
        });
      }
      // FK: veículo/motorista têm de ser da MESMA empresa.
      await assertRefsOwned(ctx.orgId, {
        veiculoId: input.veiculoId,
        motoristaId: input.motoristId,
      });
      const buffer = Buffer.from(input.dataBase64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_DOC_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Arquivo vazio ou maior que 10 MB.",
        });
      }
      const key = buildObjectKey(ctx.orgId, input.fileName);
      await putObject(key, buffer, input.contentType);
      return createDocument(ctx.orgId, {
        tipo: input.tipo,
        descricao: input.descricao ?? input.fileName.slice(0, 150),
        veiculoId: input.veiculoId ?? null,
        motoristId: input.motoristId ?? null,
        dataVencimento: input.dataVencimento ?? null,
        arquivoKey: key,
        arquivoUrl: null,
        status: "ativo",
      });
    }),

  downloadUrl: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(ctx.orgId, input.id);
      if (!doc?.arquivoKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento não encontrado.",
        });
      }
      const url = await getDownloadUrl(
        doc.arquivoKey,
        doc.descricao ?? undefined
      );
      return { url };
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await getDocumentById(ctx.orgId, input.id);
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento não encontrado.",
        });
      }
      if (doc.arquivoKey) {
        try {
          await deleteObject(doc.arquivoKey);
        } catch (e) {
          console.warn("[Documents] falha ao apagar objeto R2:", e);
        }
      }
      return deleteDocument(ctx.orgId, input.id);
    }),
});
