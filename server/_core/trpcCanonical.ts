import type { Request, Response, NextFunction } from "express";
import { trpcErrorBody } from "./trpcErrorBody";
import { setTrpcProc } from "./uploadCapability";

// Resultado da análise do path relativo dentro do mount /api/trpc.
export type TrpcPathParse =
  | { ok: true; proc: string; batch: boolean }
  | { ok: false; reason: string };

// Analisa o path RELATIVO ao mount (`req.path`, ex.: "/documents.upload") junto
// da URL original (para flagrar barra codificada, que o roteador já teria
// decodificado). Uma chamada canônica do httpLink (sem batching) é EXATAMENTE
// "/<proc>" com UM segmento — nomes de procedure usam letras, dígitos, "_" e
// ".". Rejeita:
//   - barra codificada (%2F) em qualquer ponto do path;
//   - path vazio ou sem a barra inicial;
//   - segmento extra / barra dupla / trailing slash (qualquer "/" além da 1ª);
//   - caracteres fora do conjunto de um nome de procedure.
// O lote (batch) chega como "a,b" (vírgula): é SINALIZADO, não rejeitado — o
// adapter, com allowBatching:false, responde 400 (preserva o comportamento
// atual). Assim aliases como "/x/documents.upload" nunca chegam ao adapter nem
// selecionam o parser grande, mas o batch continua com o mesmo 400 de sempre.
export function parseTrpcPath(
  relPath: string,
  originalUrl: string
): TrpcPathParse {
  const pathPart = originalUrl.split("?")[0] ?? "";
  if (/%2f/i.test(pathPart)) return { ok: false, reason: "encoded-slash" };
  // ⚠️ Barra dupla na fronteira do mount ("/api/trpc//documents.upload") é
  // COLAPSADA pelo Express: req.path chegaria "/documents.upload" (canônico) e
  // rotearia para a procedure. Por isso a barra dupla é flagrada na URL
  // ORIGINAL, não no req.path já normalizado. (Confirmado com o pipeline real.)
  if (pathPart.includes("//")) return { ok: false, reason: "double-slash" };
  if (relPath.length < 2 || relPath[0] !== "/") {
    return { ok: false, reason: "empty" };
  }
  // Qualquer "/" além da inicial = segmento extra, barra dupla ou trailing.
  if (relPath.indexOf("/", 1) !== -1) {
    return { ok: false, reason: "extra-segment" };
  }
  const proc = relPath.slice(1);
  const batch = proc.includes(",");
  // Nome de procedure ÚNICA (fora batch) só pode ter estes caracteres.
  if (!batch && !/^[A-Za-z0-9_.]+$/.test(proc)) {
    return { ok: false, reason: "invalid-chars" };
  }
  return { ok: true, proc, batch };
}

// Middleware: 1º da cadeia /api/trpc. Rejeita path não-canônico ANTES de
// qualquer parser/adapter (alias, barra dupla, trailing, %2F). Guarda a
// procedure canônica em res.locals para a barreira de upload e o seletor.
export function trpcCanonicalGate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const parsed = parseTrpcPath(req.path, req.originalUrl ?? "");
  if (!parsed.ok) {
    res
      .status(404)
      .json(trpcErrorBody("NOT_FOUND", 404, "Rota não encontrada."));
    return;
  }
  setTrpcProc(res, parsed.proc);
  next();
}
