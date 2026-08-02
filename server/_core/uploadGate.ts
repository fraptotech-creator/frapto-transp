import type { Request, Response, NextFunction } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { allowRequest } from "./rateLimit";
import { uploadSemaphore } from "./concurrency";
import { trpcErrorBody, type TrpcErrorKey } from "./trpcErrorBody";
import {
  grantUploadCapability,
  getTrpcProc,
  UPLOAD_PROC,
} from "./uploadCapability";

// Limites do upload de documento — MUITO menores que o geral (300/min): é uma
// operação cara (até ~13 MB parseados). Uso humano de upload cabe folgado.
export const UPLOAD_RATE_LIMIT = 30; // por minuto, por usuário
export const UPLOAD_RATE_WINDOW_MS = 60 * 1000;
export const UPLOAD_CONCURRENCY_PER_USER = 2;
export const UPLOAD_CONCURRENCY_GLOBAL = 10;
// Teto por IP do endpoint de upload — roda ANTES de autenticar/logar. Barra
// flood de cookie ausente/inválido (cada um gastaria verificação de JWT + uma
// linha de log): sem este backstop, um atacante sem sessão inundaria o log e a
// CPU antes do 401. Alto o bastante para uso humano legítimo.
export const UPLOAD_IP_LIMIT = 60; // por minuto, por IP
export const UPLOAD_IP_WINDOW_MS = 60 * 1000;

function deny(
  res: Response,
  status: number,
  code: TrpcErrorKey,
  msg: string
): void {
  res.status(status).json(trpcErrorBody(code, status, msg));
}

// Barreira do path /api/trpc/documents.upload, montada ANTES do seletor de
// parser. Só ATUA nesse path; as demais procedures seguem direto (next). Ordem
// fail-closed:
//   1) backstop por IP (antes de autenticar/logar; limita cookie ausente/lixo);
//   2) só POST (qualquer outro método é negado ANTES de parser de corpo);
//   3) sessão ATIVA — não só JWT assinado: usuário existe e sessionVersion bate
//      (revogação); SEM efeito colateral (não faz touch de lastSignedIn aqui);
//   4) rate-limit dedicado por USUÁRIO;
//   5) concorrência (por usuário + global), com release ao fim da resposta;
//   6) concede a CAPACIDADE (marca interna) — só então o parser de 15 MB libera.
// Se qualquer passo nega, NÃO chama next() → o parser (middleware seguinte)
// nunca roda e o corpo não é consumido.
export async function uploadGate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (getTrpcProc(res) !== UPLOAD_PROC) {
    next();
    return;
  }
  // 1) Backstop por IP — antes de autenticar/logar.
  const ip = req.ip ?? "0.0.0.0";
  if (
    !allowRequest(
      `upload-ip:${ip}`,
      UPLOAD_IP_LIMIT,
      UPLOAD_IP_WINDOW_MS,
      Date.now()
    )
  ) {
    deny(res, 429, "TOO_MANY_REQUESTS", "Muitas requisições deste IP.");
    return;
  }
  // 2) Só POST usa o parser grande; outro método é negado ANTES do parser.
  if (req.method !== "POST") {
    deny(res, 405, "METHOD_NOT_SUPPORTED", "Método não suportado.");
    return;
  }
  // 3) Sessão ATIVA (usuário + sver), sem efeito colateral (sem touch).
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const user = await sdk.validateActiveSession(cookies[COOKIE_NAME]);
  if (!user) {
    deny(res, 401, "UNAUTHORIZED", "Sessão inválida ou ausente.");
    return;
  }
  // 4) Rate-limit dedicado por USUÁRIO.
  const key = `upload:${user.openId}`;
  if (
    !allowRequest(key, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS, Date.now())
  ) {
    deny(
      res,
      429,
      "TOO_MANY_REQUESTS",
      "Muitos uploads em pouco tempo. Aguarde um instante."
    );
    return;
  }
  // 5) Concorrência (por usuário e global). Libera ao fim da resposta —
  // sucesso, 413, erro do adapter (finish) ou conexão abortada (close).
  if (
    !uploadSemaphore.acquire(
      key,
      UPLOAD_CONCURRENCY_PER_USER,
      UPLOAD_CONCURRENCY_GLOBAL
    )
  ) {
    deny(
      res,
      429,
      "TOO_MANY_REQUESTS",
      "Muitos uploads simultâneos. Aguarde terminar."
    );
    return;
  }
  let released = false;
  const soltar = () => {
    if (!released) {
      released = true;
      uploadSemaphore.release(key);
    }
  };
  res.on("finish", soltar);
  res.on("close", soltar);
  // 6) Capacidade concedida: o seletor libera o parser de 15 MB só com esta
  // marca + POST + path canônico. O usuário validado viaja para o contexto.
  grantUploadCapability(res, user);
  next();
}
