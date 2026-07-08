import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import {
  publicProcedure,
  protectedProcedure,
  router,
  orgProcedure,
} from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  getUserByEmail,
  createOrgAndOwner,
  incrementSessionVersion,
  getOrganization,
} from "../db";
import {
  createCheckoutSession,
  createPortalSession,
  isStripeConfigured,
} from "../_core/stripe";

// Config pública do cliente (só p/ logado). A chave do Google Maps é pública
// por design (browser, restrita por referrer) — não é segredo como as demais.
export const configRouter = router({
  get: protectedProcedure.query(() => ({
    googleMapsApiKey: ENV.googleMapsApiKey,
    mapsConfigured: Boolean(ENV.googleMapsApiKey),
  })),
});

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    // Nunca expõe o hash da senha ao browser.
    const { passwordHash: _omit, ...safe } = ctx.user;
    return safe;
  }),

  signup: publicProcedure
    .input(
      z.object({
        orgName: z.string().min(1, "Nome da empresa é obrigatório"),
        name: z.string().optional(),
        email: z.string().email("Email inválido"),
        password: z.string().min(8, "A senha precisa de ao menos 8 caracteres"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma conta com este email.",
        });
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      const openId = `local_${randomBytes(16).toString("hex")}`;
      const user = await createOrgAndOwner({
        orgName: input.orgName.trim(),
        openId,
        email,
        passwordHash,
        name: input.name?.trim() || null,
      });
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar a conta.",
        });
      }
      const token = await sdk.createSessionToken(openId, {
        name: user.name ?? "",
        sessionVersion: user.sessionVersion,
        expiresInMs: ONE_YEAR_MS,
      });
      ctx.res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: ONE_YEAR_MS,
      });
      return { success: true } as const;
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Informe a senha"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      const user = await getUserByEmail(email);
      // Mensagem genérica (não revela se o email existe).
      const invalid = new TRPCError({
        code: "UNAUTHORIZED",
        message: "Email ou senha inválidos.",
      });
      if (!user || !user.passwordHash) throw invalid;
      const ok = await bcrypt.compare(input.password, user.passwordHash);
      if (!ok) throw invalid;

      const token = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        sessionVersion: user.sessionVersion,
        expiresInMs: ONE_YEAR_MS,
      });
      ctx.res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: ONE_YEAR_MS,
      });
      return { success: true } as const;
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Revoga a sessão no servidor (mata o token, mesmo se roubado).
    if (ctx.user) {
      await incrementSessionVersion(ctx.user.openId);
    }
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// Cobrança/assinatura (Stripe). Acessível mesmo sem assinatura ativa,
// pra que o usuário logado consiga pagar e liberar o sistema.
export const billingRouter = router({
  getStatus: orgProcedure.query(async ({ ctx }) => {
    const org = await getOrganization(ctx.orgId);
    const status = org?.subscriptionStatus ?? "none";
    return {
      status,
      active: status === "active" || status === "trialing",
      currentPeriodEnd: org?.currentPeriodEnd ?? null,
      configured: isStripeConfigured(),
      priceLabel: "R$ 57,00/mês",
    };
  }),

  createCheckout: orgProcedure.mutation(async ({ ctx }) => {
    const url = await createCheckoutSession({
      orgId: ctx.orgId,
      email: ctx.user.email ?? "",
    });
    return { url };
  }),

  createPortal: orgProcedure.mutation(async ({ ctx }) => {
    const url = await createPortalSession(ctx.orgId);
    return { url };
  }),
});
