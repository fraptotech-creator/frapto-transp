import type { Request, Response, NextFunction } from "express";
import { toSafeLogError } from "./safeLog";
import { trpcErrorBody } from "./trpcErrorBody";

// Handler de ERRO da cadeia /api/trpc (4 args → o Express o reconhece como
// error-handling middleware). Recebe falhas INESPERADAS que pularam o parser e o
// adapter (ex.: rejeição de middleware async capturada pelo asyncHandler).
// Responde 5xx SANITIZADO — sem stack, causa, segredo ou corpo grande — logando
// só a classe do erro (allowlist do toSafeLogError). Como o erro pula o parser e
// o adapter, nenhuma capability é concedida e o corpo grande nunca é lido.
// Extrai um status HTTP próprio do erro (ex.: PayloadTooLargeError do body-parser
// traz status 413). 0 quando não há.
function httpStatusOf(err: unknown): number {
  if (err && typeof err === "object") {
    const o = err as { status?: unknown; statusCode?: unknown };
    const s = typeof o.status === "number" ? o.status : o.statusCode;
    if (typeof s === "number" && s >= 400 && s <= 599) return s;
  }
  return 0;
}

export function trpcErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Se a resposta já começou, não dá para trocar o status — delega ao default.
  if (res.headersSent) {
    next(err);
    return;
  }
  // Erro de CLIENTE com status próprio (ex.: 413 do body-parser, 408) — preserva
  // o comportamento padrão do Express (status correto), sem nossa interferência.
  const status = httpStatusOf(err);
  if (status >= 400 && status < 500) {
    next(err);
    return;
  }
  // Falha INESPERADA (sem status ou 5xx): 500 sanitizado, só a classe no log.
  console.error("[tRPC] erro não tratado na borda:", toSafeLogError(err));
  res
    .status(500)
    .json(
      trpcErrorBody(
        "INTERNAL_SERVER_ERROR",
        500,
        "Erro interno. Tente novamente."
      )
    );
}
