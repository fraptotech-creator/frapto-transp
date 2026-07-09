import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getOrganization } from "../db";
import { friendlyDbErrorMessage } from "./dbErrors";

// Mensagem-sentinela: o frontend reconhece e mostra a tela de assinatura.
export const SUBSCRIPTION_REQUIRED_MSG = "SUBSCRIPTION_REQUIRED";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Nunca vaza SQL/schema pro cliente. Erros INTERNAL (não-TRPCError, ex.: falha
  // de query) viram uma mensagem clara: se for chave duplicada, diz QUAL campo
  // colidiu; senão, mensagem genérica. Erros com código próprio (UNAUTHORIZED,
  // FORBIDDEN, BAD_REQUEST do zod, etc.) passam intactos.
  errorFormatter({ shape, error }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      const friendly = friendlyDbErrorMessage(error);
      return {
        ...shape,
        message:
          friendly ??
          "Erro interno ao processar a solicitação. Tente novamente.",
      };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

// Exige usuário autenticado E vinculado a uma organização; injeta ctx.orgId
// (não-nulo) para o escopo multi-tenant de todas as consultas.
export const orgProcedure = protectedProcedure.use(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user.orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Usuário sem organização.",
    });
  }
  return next({ ctx: { ...ctx, orgId: ctx.user.orgId } });
});

// Como orgProcedure, mas exige que o usuário seja DONO da organização
// (config de IA, cobrança, etc.).
export const orgOwnerProcedure = orgProcedure.use(async opts => {
  const { ctx, next } = opts;
  if (ctx.user.orgRole !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o dono da organização pode fazer isso.",
    });
  }
  return next({ ctx });
});

// Gate de PAGAMENTO: além de exigir org, exige assinatura ativa (ou em trial).
// Sem assinatura, lança SUBSCRIPTION_REQUIRED → o front mostra o paywall.
// Usado nas features do sistema; auth/billing ficam FORA (pra poder pagar).
export const activeOrgProcedure = orgProcedure.use(async opts => {
  const { ctx, next } = opts;
  const org = await getOrganization(ctx.orgId);
  const status = org?.subscriptionStatus;
  const active = status === "active" || status === "trialing";
  if (!active) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: SUBSCRIPTION_REQUIRED_MSG,
    });
  }
  return next({ ctx: { ...ctx, org } });
});
