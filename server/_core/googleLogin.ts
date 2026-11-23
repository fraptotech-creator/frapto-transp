/**
 * Login com Google (OAuth 2.0) — SEM dependência nova: usa `fetch` direto nos
 * endpoints do Google. Espelha o fluxo do frapto-med, com 2 travas a mais:
 *   - state com NONCE em cookie httpOnly (anti-CSRF de login);
 *   - exige email_verified do Google.
 * A decisão (saneamento de returnPath, state) é PURA e testável; o efeito
 * (fetch Google, banco, cookie) fica na borda, nos handlers.
 */
import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./env";
import { toSafeLogError } from "./safeLog";
import {
  getUserByEmail,
  touchUserLastSignedIn,
  createGoogleOrgOwner,
} from "../db";

const STATE_COOKIE = "g_oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // o fluxo todo leva segundos; 10 min folga

// Recurso ligado só com AS DUAS credenciais setadas (fail-closed).
export function googleLoginConfigurado(): boolean {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

// returnPath vem do state (controlável pelo atacante): só caminho INTERNO. Barra
// "//" e "/\" (protocol-relative / backslash) que o browser trata como host
// externo → senão um login forjado joga o usuário recém-logado no domínio do
// atacante (phishing pós-login). Fora disso → /dashboard.
export function sanitizeReturnPath(raw: string | undefined | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\")
  ) {
    return "/dashboard";
  }
  return raw;
}

export function encodeState(data: {
  returnPath: string;
  nonce: string;
}): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

export function decodeState(
  raw: string | undefined | null
): { returnPath: string; nonce: string } | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (typeof obj?.nonce !== "string") return null;
    return {
      returnPath: sanitizeReturnPath(obj.returnPath),
      nonce: obj.nonce,
    };
  } catch {
    return null;
  }
}

// Comparação em tempo constante de dois nonces (string).
export function nonceConfere(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type DecisaoGoogle =
  | { acao: "criar" }
  | { acao: "entrar"; sessionVersion: number }
  | { acao: "negar"; erro: "google_driver" | "google_conta_senha" };

// Quem entra pelo Google, dado o usuário que JÁ tem esse e-mail (ou nenhum).
// PURA — o callback só executa a decisão.
//  - sem conta → cria empresa + dono;
//  - conta criada PELO GOOGLE → entra, com o sessionVersion ATUAL (o token
//    precisa dele, senão quem já fez logout cai em loop no /login);
//  - motorista → nega (entra pelo app do motorista);
//  - conta criada com SENHA → NÃO vincula. O cadastro por senha não confirma o
//    e-mail: um atacante pode pré-cadastrar o e-mail da vítima com a senha dele
//    e, no 1º "Continuar com Google", a vítima cairia na empresa do atacante
//    (que segue entrando pela senha). Fail-closed: a pessoa entra com a senha.
export function decidirLoginGoogle(
  existente:
    | {
        orgRole: string;
        loginMethod: string | null;
        sessionVersion: number;
      }
    | null
    | undefined
): DecisaoGoogle {
  if (!existente) return { acao: "criar" };
  if (existente.orgRole === "driver")
    return { acao: "negar", erro: "google_driver" };
  if (existente.loginMethod !== "google")
    return { acao: "negar", erro: "google_conta_senha" };
  return { acao: "entrar", sessionVersion: existente.sessionVersion };
}

// Lê um cookie do header cru (não dependemos de cookie-parser).
function lerCookie(req: Request, nome: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const parte of raw.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim());
    }
  }
  return null;
}

function baseUrl(req: Request): string {
  const base = ENV.appBaseUrl || `${req.protocol}://${req.get("host")}`;
  return base.replace(/\/+$/, "");
}

function callbackUrl(req: Request): string {
  return `${baseUrl(req)}/api/auth/google/callback`;
}

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

export function registerGoogleLoginRoutes(app: Express) {
  // Início do fluxo: redireciona ao consent do Google.
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!googleLoginConfigurado()) {
      res.redirect(302, "/login?error=google_indisponivel");
      return;
    }
    const returnPath = sanitizeReturnPath(req.query.return as string);
    const nonce = randomBytes(16).toString("hex");

    // Nonce no cookie httpOnly: só o browser do usuário o devolve no callback.
    res.cookie(STATE_COOKIE, nonce, {
      ...getSessionCookieOptions(req),
      maxAge: STATE_MAX_AGE_MS,
      // Lax: o callback do Google é uma navegação top-level GET, que envia Lax.
      sameSite: "lax",
    });

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: callbackUrl(req),
      response_type: "code",
      scope: "openid email profile",
      state: encodeState({ returnPath, nonce }),
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(
      302,
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  // Callback: valida state, troca o código, cria sessão.
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    // Sempre limpa o cookie de state (uso único), aconteça o que acontecer.
    // clearCookie já expira o cookie; passar maxAge é obsoleto no Express
    // (aviso no log de produção) e é ignorado no Express 5.
    const limparState = () =>
      res.clearCookie(STATE_COOKIE, getSessionCookieOptions(req));

    const falha = (code: string) => {
      limparState();
      res.redirect(302, `/login?error=${code}`);
    };

    if (!googleLoginConfigurado()) return falha("google_indisponivel");

    const code = req.query.code as string | undefined;
    const state = decodeState(req.query.state as string);
    const cookieNonce = lerCookie(req, STATE_COOKIE);

    // Anti-CSRF: o nonce do state tem que casar com o do cookie httpOnly.
    if (!state || !cookieNonce || !nonceConfere(cookieNonce, state.nonce)) {
      console.warn("[GoogleAuth] state/nonce inválido");
      return falha("google_state");
    }
    if (!code) return falha("missing_code");

    try {
      // 1) Troca o código por tokens (server-to-server, sobre TLS).
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: callbackUrl(req),
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResp.ok) {
        console.error("[GoogleAuth] token exchange falhou:", tokenResp.status);
        return falha("auth_failed");
      }
      const tokenData = (await tokenResp.json()) as { access_token?: string };
      if (!tokenData.access_token) return falha("auth_failed");

      // 2) Busca o perfil com o access_token.
      const infoResp = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      if (!infoResp.ok) return falha("auth_failed");
      const info = (await infoResp.json()) as GoogleUserInfo;

      const email = info.email?.trim().toLowerCase();
      const verificado =
        info.email_verified === true || info.email_verified === "true";
      if (!email || !verificado) {
        console.warn("[GoogleAuth] email ausente ou não verificado");
        return falha("no_email");
      }

      // 3) Resolve o usuário pela decisão PURA (decidirLoginGoogle).
      const existente = await getUserByEmail(email);
      const decisao = decidirLoginGoogle(existente);
      if (decisao.acao === "negar") return falha(decisao.erro);
      let openId: string;
      let nome: string;
      let sessionVersion = 0;
      if (decisao.acao === "entrar" && existente) {
        openId = existente.openId;
        nome = existente.name ?? info.name ?? "";
        sessionVersion = decisao.sessionVersion;
        await touchUserLastSignedIn(openId);
      } else {
        openId = `google_${info.sub || email.replace(/[^a-z0-9]/gi, "_")}`;
        nome = info.name || email.split("@")[0];
        const orgName = info.name ? `Empresa de ${info.name}` : email;
        await createGoogleOrgOwner({ orgName, openId, email, name: nome });
      }

      // 4) Mesma sessão do login por senha.
      // sver TEM que bater com users.sessionVersion (sdk.validateActiveSession);
      // sem ele, quem já fez logout/trocou senha caía em loop no /login.
      const sessionToken = await sdk.createSessionToken(openId, {
        name: nome,
        sessionVersion,
        expiresInMs: ONE_YEAR_MS,
      });
      limparState();
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect(302, state.returnPath);
    } catch (e) {
      console.error("[GoogleAuth] callback erro:", toSafeLogError(e));
      return falha("auth_failed");
    }
  });
}
