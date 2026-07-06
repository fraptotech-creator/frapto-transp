/**
 * Google OAuth Login Routes
 * Autenticação direta com Google — sem intermediário Manus.
 * Usa GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configurados no projeto.
 */
import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { users } from "../drizzle/schema";
import * as db from "./db";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

function getOAuth2Client(redirectUri: string) {
  return new google.auth.OAuth2(
    ENV.googleClientId,
    ENV.googleClientSecret,
    redirectUri
  );
}

function getCallbackUrl(req: Request): string {
  // Usar APP_BASE_URL em produção, ou o host do request em dev.
  const base = ENV.appBaseUrl || `${req.protocol}://${req.get("host")}`;
  return `${base}/api/auth/google/callback`;
}

// [SEGURANÇA] open-redirect: returnPath vem do state (controlável pelo atacante).
// Só aceita caminho interno (começa com "/" mas não "//" nem "/\").
function safeInternalPath(p: unknown): string {
  return typeof p === "string" &&
    p.startsWith("/") &&
    !p.startsWith("//") &&
    !p.startsWith("/\\")
    ? p
    : "/";
}

export function registerGoogleLoginRoutes(app: Express) {
  // GET /api/auth/google — inicia o fluxo OAuth
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const returnPath = safeInternalPath(req.query.return);
    const callbackUrl = getCallbackUrl(req);
    const oauth2Client = getOAuth2Client(callbackUrl);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      state: Buffer.from(
        JSON.stringify({ returnPath, callbackUrl })
      ).toString("base64"),
      prompt: "select_account",
    });

    res.redirect(302, authUrl);
  });

  // GET /api/auth/google/callback — troca o código pelo token e cria sessão
  app.get(
    "/api/auth/google/callback",
    async (req: Request, res: Response) => {
      const code = req.query.code as string | undefined;
      const stateRaw = req.query.state as string | undefined;

      if (!code) {
        console.error("[GoogleAuth] Missing code in callback");
        res.redirect(302, "/?error=missing_code");
        return;
      }

      let returnPath = "/";
      let callbackUrl = getCallbackUrl(req);

      try {
        if (stateRaw) {
          const stateObj = JSON.parse(
            Buffer.from(stateRaw, "base64").toString()
          );
          returnPath = safeInternalPath(stateObj.returnPath);
          callbackUrl =
            typeof stateObj.callbackUrl === "string"
              ? stateObj.callbackUrl
              : callbackUrl;
        }
      } catch (e) {
        console.warn("[GoogleAuth] Failed to parse state, using defaults");
      }

      try {
        const oauth2Client = getOAuth2Client(callbackUrl);
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        if (!userInfo.email) {
          console.error("[GoogleAuth] No email returned from Google");
          res.redirect(302, "/?error=no_email");
          return;
        }

        // Reutiliza o openId de um usuário já existente com o mesmo email
        // (mantém o vínculo se ele tiver sido criado por outro método).
        const dbConn = await getDb();
        let openId = `google_${userInfo.id || userInfo.email.replace(/[^a-z0-9]/gi, "_")}`;

        if (dbConn) {
          const [byEmail] = await dbConn
            .select()
            .from(users)
            .where(eq(users.email, userInfo.email))
            .limit(1);
          if (byEmail) {
            openId = byEmail.openId;
          }
        }

        await db.upsertUser({
          openId,
          name: userInfo.name || userInfo.email.split("@")[0],
          email: userInfo.email,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        res.redirect(302, returnPath);
      } catch (error) {
        console.error(
          "[GoogleAuth] Callback error:",
          error instanceof Error ? error.message : error
        );
        res.redirect(302, "/?error=auth_failed");
      }
    }
  );
}
