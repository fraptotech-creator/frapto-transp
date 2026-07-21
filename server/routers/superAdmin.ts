import { superAdminProcedure, router } from "../_core/trpc";
import {
  listOrgsWithStatsForSuperAdmin,
  getOrganization,
  updateOrganization,
} from "../db";
import { decidirMudancaAcesso } from "../_core/superAdminAccess";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Painel do SUPER-ADMIN da plataforma (dono do SaaS): visão de TODAS as
// empresas. Somente leitura por enquanto. Protegido por superAdminProcedure
// (openId+email da env, fail-closed).
export const superAdminRouter = router({
  overview: superAdminProcedure.query(async () => {
    const orgs = await listOrgsWithStatsForSuperAdmin();
    const ativa = (s: string | null) => s === "active" || s === "trialing";
    return {
      orgs,
      totais: {
        empresas: orgs.length,
        ativas: orgs.filter(o => ativa(o.subscriptionStatus)).length,
        inativas: orgs.filter(o => !ativa(o.subscriptionStatus)).length,
        veiculos: orgs.reduce((s, o) => s + o.veiculos, 0),
        motoristas: orgs.reduce((s, o) => s + o.motoristas, 0),
        viagens: orgs.reduce((s, o) => s + o.viagens, 0),
      },
    };
  }),

  // Libera/bloqueia acesso NA MÃO (cliente que pagou por fora do Stripe).
  // A regra de quando pode está em _core/superAdminAccess.ts (pura, testada);
  // aqui só o efeito.
  setAccess: superAdminProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        acao: z.enum(["liberar", "bloquear"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const org = await getOrganization(input.orgId);
      const decisao = decidirMudancaAcesso(org, input.acao);
      if (!decisao.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: decisao.motivo });
      }
      await updateOrganization(input.orgId, decisao.patch);
      // Ação privilegiada: deixa rastro de QUEM mexeu em QUAL empresa.
      console.info(
        `[SuperAdmin] ${ctx.user.email} ${input.acao} acesso da org ${input.orgId} (${org?.name ?? "?"})`
      );
      return { ok: true as const, acao: input.acao };
    }),
});
