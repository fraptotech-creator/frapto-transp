import { superAdminProcedure, router } from "../_core/trpc";
import { listOrgsWithStatsForSuperAdmin } from "../db";

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
});
