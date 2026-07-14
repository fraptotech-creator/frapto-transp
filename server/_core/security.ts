import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { ENV } from "./env";

// Headers de segurança (1º middleware). Sem CSP por ora (evita quebrar o bundle
// e o redirect do Stripe); os demais fecham clickjacking e MIME-sniffing.
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
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

// Rate-limit geral da API (por IP). Generoso — só barra abuso/DoS.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em instantes." },
});

// Rate-limit do rastreio (/api/track). Chaveado pelo TOKEN do motorista, não
// por IP: várias vans atrás do mesmo IP de operadora (CGNAT) não se
// auto-bloqueiam. Sem token, cai no IP (normalizado p/ IPv6).
export const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const t =
      req.body && typeof req.body.token === "string" ? req.body.token : "";
    return t ? `tok:${t}` : ipKeyGenerator(req.ip ?? "0.0.0.0");
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

// Rate-limit estrito para login/cadastro (anti brute-force).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

// CSRF (defesa em profundidade, além do sameSite=lax): se vier Origin e não
// bater com APP_BASE_URL, nega. Requisições sem Origin (server-to-server, curl)
// passam — elas não carregam o cookie de sessão do navegador de qualquer forma.
export function originCheck(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ENV.appBaseUrl && origin !== ENV.appBaseUrl) {
    res.status(403).json({ error: "Origin não permitido." });
    return;
  }
  next();
}
