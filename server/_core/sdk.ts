import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  // Versão da sessão (revogação). Ausente em tokens antigos (grandfather).
  sver?: number;
};

/**
 * SDKServer — sessão própria via JWT (HS256), sem intermediário Manus.
 * O login em si (email/senha) fica em server/routers/account.ts, que chama
 * createSessionToken() para emitir o cookie de sessão.
 */
class SDKServer {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId.
   * @example
   * const sessionToken = await sdk.createSessionToken(openId, { name });
   */
  async createSessionToken(
    openId: string,
    options: {
      expiresInMs?: number;
      name?: string;
      sessionVersion?: number;
    } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        sver: options.sessionVersion ?? 0,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    const claims: Record<string, unknown> = {
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    };
    if (typeof payload.sver === "number") claims.sver = payload.sver;

    return new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<{
    openId: string;
    appId: string;
    name: string;
    sver: number;
  } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, sver } = payload as Record<string, unknown>;

      // openId identifica a sessão e é obrigatório. O `name` é só exibição e
      // pode ser vazio (usuário sem nome) — não rejeita por name.
      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing openId");
        return null;
      }
      // appId EXATO desta app: um token válido de OUTRA app que compartilhe o
      // mesmo segredo/infra não vale aqui (isolamento entre apps).
      if (appId !== ENV.appId) {
        console.warn("[Auth] Session appId mismatch");
        return null;
      }
      // sver OBRIGATÓRIO: sem versão de sessão o token não é revogável (logout
      // não o mata). Todos os emissores atuais incluem sver; só cai aqui token
      // legado (janela de jul/6-8) — que é deslogado de propósito.
      if (typeof sver !== "number") {
        console.warn("[Auth] Session without sver (legacy) rejected");
        return null;
      }

      return {
        openId,
        appId,
        name: isNonEmptyString(name) ? name : "",
        sver,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    // O usuário é criado no cadastro (auth.signup). Se a sessão é válida mas o
    // usuário sumiu do banco, falha fechado (não sincroniza cego).
    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Revogação: o token sempre traz `sver` (verifySession rejeita sem ele); se
    // diverge do atual do usuário, o token foi revogado (logout/troca de senha).
    if (session.sver !== user.sessionVersion) {
      throw ForbiddenError("Session revoked");
    }

    await db.touchUserLastSignedIn(user.openId);

    return user;
  }
}

export const sdk = new SDKServer();
