import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createHash } from "crypto";
import { ENV } from "./env";
import { TRACK_TOKEN_RE, tokenDaRequisicao } from "./trackIngest";
import {
  trpcErrorBody,
  isTrpcRequest,
  type TrpcErrorKey,
} from "./trpcErrorBody";

// Content-Security-Policy: só deixa o navegador carregar script do próprio
// site — um XSS injetado não consegue puxar script de fora nem mandar dados
// para outro host. Hosts liberados = o que a tela usa de verdade (conferido no
// código em 23/11/2026): mapas do OpenStreetMap e Google Fonts. style
// 'unsafe-inline' porque os componentes (Radix, gráficos) usam style inline.
// Stripe e Google entram por NAVEGAÇÃO (não regida por CSP).
// Fase 1 (PR #28) foi Report-Only; conferido em produção em 23/11/2026 — 15
// telas logadas + páginas públicas, ouvinte de securitypolicyviolation, 0
// violações e todos os hosts carregados cobertos. Fase 2: BLOQUEIA.
// Exceção: em desenvolvimento o Vite injeta script inline (react-refresh), então
// lá segue só avisando. Fail-closed: qualquer NODE_ENV que não seja
// "development" (inclusive ausente) BLOQUEIA.
export function cabecalhoCsp(nodeEnv: string | undefined): string {
  return nodeEnv === "development"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
}

export const POLITICA_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Headers de segurança (1º middleware): CSP (ver acima), clickjacking e
// MIME-sniffing.
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.setHeader(cabecalhoCsp(process.env.NODE_ENV), POLITICA_CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps =
    req.protocol === "https" ||
    (typeof forwardedProto === "string" && forwardedProto.includes("https"));
  if (isHttps) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  next();
}

// Resposta de limite estourado. Em /api/trpc precisa sair no envelope do tRPC,
// senão o cliente não desserializa e o usuário vê um erro de framework em vez
// do motivo real.
function limiteExcedido(
  req: Request,
  res: Response,
  code: TrpcErrorKey,
  httpStatus: number,
  message: string
) {
  res
    .status(httpStatus)
    .json(
      isTrpcRequest(req.originalUrl)
        ? trpcErrorBody(code, httpStatus, message)
        : { error: message }
    );
}

// Rate-limit geral da API (por IP). Generoso — só barra abuso/DoS.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    limiteExcedido(
      req,
      res,
      "TOO_MANY_REQUESTS",
      429,
      "Muitas requisições. Tente novamente em instantes."
    ),
});

// Chave de rate-limit por token (PURA, testável). Só token no formato real vira
// chave, e como HASH de tamanho FIXO (SHA-256) — assim uma string de 1 MB nunca
// vira uma entrada gigante/única no store (DoS de memória). Malformado → null,
// e o chamador cai no IP.
export function trackTokenKey(raw: string): string | null {
  return TRACK_TOKEN_RE.test(raw)
    ? `tok:${createHash("sha256").update(raw).digest("hex")}`
    : null;
}

// Rate-limit do rastreio (/api/track). Chaveado pelo TOKEN do motorista, não
// por IP: várias vans atrás do mesmo IP de operadora (CGNAT) não se
// auto-bloqueiam. Sem token válido, cai no IP (normalizado p/ IPv6).
export const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Token no corpo (app antigo) ou no "Authorization: Bearer" (app novo).
    const raw = tokenDaRequisicao(req.body, req.headers.authorization) ?? "";
    return trackTokenKey(raw) ?? ipKeyGenerator(req.ip ?? "0.0.0.0");
  },
  message: { error: "Muitas requisições de rastreio. Aguarde um instante." },
});

// Teto por IP no /api/track: limita abuso (ex.: rotação de tokens falsos) sem
// travar frota legítima. Ceiling alto — só barra flood.
export const trackIpBackstop = rateLimit({
  windowMs: 60 * 1000,
  limit: 1200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  message: { error: "Muitas requisições deste IP." },
});

// Rate-limit do webhook do Stripe (por IP). ALTO de propósito: o Stripe faz
// retries e pode enfileirar rajadas de eventos legítimos — o teto só barra
// flood. Montado ANTES do parser raw + HMAC, para um flood não consumir
// CPU/memória de verificação. Não usa o envelope tRPC (é rota REST do Stripe).
export const stripeWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  message: { error: "Muitas requisições de webhook." },
});

// Rate-limit estrito para login/cadastro (anti brute-force).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    limiteExcedido(
      req,
      res,
      "TOO_MANY_REQUESTS",
      429,
      "Muitas tentativas. Aguarde alguns minutos."
    ),
});

// CSRF (defesa em profundidade, além do sameSite=lax): se vier Origin e não
// bater com APP_BASE_URL, nega. Requisições sem Origin (server-to-server, curl)
// passam — elas não carregam o cookie de sessão do navegador de qualquer forma.
export function originCheck(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ENV.appBaseUrl && origin !== ENV.appBaseUrl) {
    const msg = "Origem da requisição não permitida.";
    res
      .status(403)
      .json(
        isTrpcRequest(req.originalUrl)
          ? trpcErrorBody("FORBIDDEN", 403, msg)
          : { error: msg }
      );
    return;
  }
  next();
}
