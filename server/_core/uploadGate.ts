import type { Request, Response, NextFunction } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { allowRequest } from "./rateLimit";
import { acquire, release } from "./concurrency";
import { trpcErrorBody } from "./trpcErrorBody";

// Limites do upload de documento — MUITO menores que o geral (300/min): é uma
// operação cara (até ~13 MB parseados). Uso humano de upload cabe folgado.
export const UPLOAD_RATE_LIMIT = 30; // por minuto, por usuário
export const UPLOAD_RATE_WINDOW_MS = 60 * 1000;
export const UPLOAD_CONCURRENCY_PER_USER = 2;
export const UPLOAD_CONCURRENCY_GLOBAL = 10;

// Barreira do /api/trpc/documents.upload, montada ANTES do parser de 15 MB:
// autentica pela sessão (cookie), aplica rate-limit dedicado e limite de
// concorrência — SEM ler o corpo. Se negar, NÃO chama next() → o parser grande
// (middleware seguinte) nunca roda e o corpo não é consumido. Reusa a validação
// de sessão existente (sdk.verifySession verifica o JWT: assinatura + sver +
// appId) — não deriva identidade do body nem aceita a mera presença do cookie.
export async function uploadGate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await sdk.verifySession(cookies[COOKIE_NAME]);
  if (!session) {
    res
      .status(401)
      .json(trpcErrorBody("UNAUTHORIZED", 401, "Sessão inválida ou ausente."));
    return;
  }
  // Rate-limit dedicado por USUÁRIO, independente do apiLimiter geral.
  if (
    !allowRequest(
      `upload:${session.openId}`,
      UPLOAD_RATE_LIMIT,
      UPLOAD_RATE_WINDOW_MS,
      Date.now()
    )
  ) {
    res
      .status(429)
      .json(
        trpcErrorBody(
          "TOO_MANY_REQUESTS",
          429,
          "Muitos uploads em pouco tempo. Aguarde um instante."
        )
      );
    return;
  }
  // Concorrência: limita o trabalho caro simultâneo (por usuário e global).
  const key = `upload:${session.openId}`;
  if (!acquire(key, UPLOAD_CONCURRENCY_PER_USER, UPLOAD_CONCURRENCY_GLOBAL)) {
    res
      .status(429)
      .json(
        trpcErrorBody(
          "TOO_MANY_REQUESTS",
          429,
          "Muitos uploads simultâneos. Aguarde terminar."
        )
      );
    return;
  }
  // Libera o slot ao fim da resposta (sucesso, erro ou conexão fechada).
  let released = false;
  const soltar = () => {
    if (!released) {
      released = true;
      release(key);
    }
  };
  res.on("finish", soltar);
  res.on("close", soltar);
  next();
}
