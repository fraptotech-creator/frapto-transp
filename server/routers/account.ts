import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
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
  getUserByUsername,
  getUserByOpenId,
  createOrgAndOwner,
  incrementSessionVersion,
  setUserPassword,
  getOrganization,
} from "../db";
import {
  createCheckoutSession,
  createPortalSession,
  isStripeConfigured,
} from "../_core/stripe";
import { assertLoginRateLimit } from "./_helpers";
import {
  gerarTokenReset,
  hashToken,
  podeRedefinir,
  expiraEm,
  linkReset,
  VALIDADE_MS,
} from "../_core/passwordReset";
import { enviarEmail } from "../_core/email";
import { emailRecuperacaoSenha } from "../_core/emailTemplates";
import { setResetToken, getUserByResetTokenHash } from "../db";
import { isSuperAdmin } from "../_core/superAdmin";
import { ENV } from "../_core/env";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    // Nunca expõe o hash da senha ao browser.
    const { passwordHash: _omit, ...safe } = ctx.user;
    // Flag só pra UI decidir se mostra o menu do painel da plataforma. O gate
    // de verdade é o superAdminProcedure no servidor — isto aqui é cosmético.
    return {
      ...safe,
      isSuperAdmin: isSuperAdmin(ctx.user, {
        openId: ENV.superAdminOpenId,
        email: ENV.superAdminEmail,
      }),
    };
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
      assertLoginRateLimit(ctx.req);
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
      assertLoginRateLimit(ctx.req);
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

  // Login do MOTORISTA por usuário + senha (separado do login por email).
  loginDriver: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, "Informe o usuário"),
        password: z.string().min(1, "Informe a senha"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertLoginRateLimit(ctx.req);
      const username = input.username.toLowerCase().trim();
      const user = await getUserByUsername(username);
      const invalid = new TRPCError({
        code: "UNAUTHORIZED",
        message: "Usuário ou senha inválidos.",
      });
      if (!user || !user.passwordHash || user.orgRole !== "driver")
        throw invalid;
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

  // Troca da própria senha (1º acesso do motorista ou a qualquer momento).
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Informe a senha atual"),
        newPassword: z
          .string()
          .min(6, "A nova senha precisa de ao menos 6 caracteres"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertLoginRateLimit(ctx.req);
      if (!ctx.user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Conta sem senha definida.",
        });
      }
      const ok = await bcrypt.compare(
        input.currentPassword,
        ctx.user.passwordHash
      );
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Senha atual incorreta.",
        });
      }
      const hash = await bcrypt.hash(input.newPassword, 10);
      await setUserPassword(ctx.user.openId, hash, false);
      // Revoga as OUTRAS sessões (troca de senha invalida tokens antigos) e
      // reemite o cookie desta sessão para não deslogar quem acabou de trocar.
      await incrementSessionVersion(ctx.user.openId);
      const updated = await getUserByOpenId(ctx.user.openId);
      const token = await sdk.createSessionToken(ctx.user.openId, {
        name: updated?.name ?? "",
        sessionVersion: updated?.sessionVersion ?? 0,
        expiresInMs: ONE_YEAR_MS,
      });
      ctx.res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: ONE_YEAR_MS,
      });
      return { success: true } as const;
    }),

  /**
   * Pede o link de recuperação.
   *
   * SEMPRE responde igual, exista o e-mail ou não. Diferenciar transformaria
   * este endpoint num oráculo para descobrir quem é cliente do sistema — e a
   * lista de clientes de um SaaS é informação de valor.
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email("E-mail inválido.") }))
    .mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req);
      const generico = { ok: true as const } as const;

      const email = input.email.trim().toLowerCase();
      const user = await getUserByEmail(email);
      // Motorista entra por usuário, não por e-mail: não tem o que recuperar
      // por aqui, e responder diferente entregaria o papel dele.
      if (!user?.email || user.orgRole === "driver") return generico;

      const { token, hash } = gerarTokenReset();
      const agora = new Date();
      await setResetToken(user.openId, hash, expiraEm(agora));

      const conteudo = emailRecuperacaoSenha({
        link: linkReset(ENV.appBaseUrl, token),
        validadeHoras: Math.round(VALIDADE_MS / 3_600_000),
      });
      try {
        await enviarEmail({
          para: user.email,
          assunto: conteudo.assunto,
          html: conteudo.html,
          texto: conteudo.texto,
        });
      } catch (e) {
        // Não vaza o motivo pro usuário (viraria oráculo), mas registra com
        // contexto — envio quebrado em silêncio deixa cliente sem conta.
        console.error(
          "[Reset] Falha ao enviar e-mail de recuperação:",
          e instanceof Error ? e.message : e
        );
        // Token pendente sem e-mail entregue é lixo: limpa para não ficar
        // uma janela de 1h aberta que ninguém pediu.
        await setResetToken(user.openId, null, null);
      }
      return generico;
    }),

  /** Redefine a senha usando o token do e-mail. */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z
          .string()
          .min(8, "A senha precisa ter ao menos 8 caracteres."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req);
      const invalido = new TRPCError({
        code: "BAD_REQUEST",
        message: "Link inválido ou expirado. Peça um novo.",
      });

      const user = await getUserByResetTokenHash(hashToken(input.token));
      if (!user) throw invalido;

      const decisao = podeRedefinir({
        hashGuardado: user.resetTokenHash,
        expiraEm: user.resetTokenExpiraEm,
        tokenRecebido: input.token,
        agora: new Date(),
      });
      if (!decisao.ok) {
        console.warn(`[Reset] Recusado (${decisao.motivo}) p/ user ${user.id}`);
        throw invalido;
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      await setUserPassword(user.openId, passwordHash, false);
      // Uso único: queima o token ANTES de responder.
      await setResetToken(user.openId, null, null);
      // Trocou a senha → derruba todas as sessões antigas, em qualquer
      // aparelho. Se a conta foi tomada, isso expulsa o invasor.
      await incrementSessionVersion(user.openId);
      return { ok: true as const };
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
      // Só existe portal do Stripe se a empresa já virou cliente lá. Sem isso,
      // createPortal lançaria "Organização sem cliente Stripe" — o botão não
      // pode aparecer. É só um booleano; nenhum ID vaza pro browser.
      hasBilling: Boolean(org?.stripeCustomerId),
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
