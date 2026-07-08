import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  router,
  orgProcedure,
  activeOrgProcedure,
  orgOwnerProcedure,
} from "./_core/trpc";
import { ENV } from "./_core/env";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  createCheckoutSession,
  createPortalSession,
  isStripeConfigured,
} from "./_core/stripe";
import {
  getUserByEmail,
  createOrgAndOwner,
  incrementSessionVersion,
  getOrganization,
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  getMaintenances,
  getMaintenanceById,
  getMaintenancesByVehicle,
  createMaintenance,
  updateMaintenance,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getRevenues,
  getRevenueById,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  getAiConfig,
  upsertAiConfig,
} from "./db";
import { invokeLLM, type ChatMessage, type AiRuntimeConfig } from "./_core/llm";
import { assertSafeBaseUrl } from "./_core/urlSafety";
import type {
  InsertVehicle,
  InsertTrip,
  InsertMaintenance,
  InsertExpense,
  InsertRevenue,
} from "../drizzle/schema";

const parseNumericString = (
  value: string | null | undefined
): string | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : String(parsed);
};

// Campos numéricos OBRIGATÓRIOS (notNull no schema). Falha fechado: entrada
// não-numérica vira erro de validação, em vez de null que estouraria no banco.
const parseRequiredNumericString = (value: string): string => {
  const parsed = parseNumericString(value);
  if (parsed === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Valor numérico inválido.",
    });
  }
  return parsed;
};

// Valida que os IDs referenciados pertencem à MESMA org — impede referência
// órfã a veículo/motorista/viagem de outra empresa (defesa explícita de tenant).
async function assertRefsOwned(
  orgId: number,
  refs: {
    veiculoId?: number | null;
    motoristaId?: number | null;
    viagemId?: number | null;
  }
) {
  if (
    refs.veiculoId != null &&
    !(await getVehicleById(orgId, refs.veiculoId))
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Veículo inválido." });
  }
  if (
    refs.motoristaId != null &&
    !(await getDriverById(orgId, refs.motoristaId))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Motorista inválido.",
    });
  }
  if (refs.viagemId != null && !(await getTripById(orgId, refs.viagemId))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Viagem inválida." });
  }
}

// ─── Assistente de IA ────────────────────────────────────────────────────────

function sanitizeChatContent(s: string): string {
  // Remove caracteres de controle (preserva tab/quebra de linha) e limita o tamanho.
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 32 || c === 9 || c === 10 || c === 13) out += ch;
  }
  return out.slice(0, 4000);
}

async function buildFleetContext(orgId: number): Promise<string> {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const [vehicles, drivers, trips, maintenances] = await Promise.all([
    getVehicles(orgId),
    getDrivers(orgId),
    getTrips(orgId),
    getMaintenances(orgId),
  ]);

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const fleetByStatus = {
    ativo: vehicles.filter(v => v.status === "ativo").length,
    manutencao: vehicles.filter(v => v.status === "manutencao").length,
    inativo: vehicles.filter(v => v.status === "inativo").length,
  };

  const cnhVencendo = drivers.filter(
    d => d.cnhVencimento && new Date(d.cnhVencimento).getTime() < in30Days
  );
  const crlvVencendo = vehicles.filter(
    v => v.crlvVencimento && new Date(v.crlvVencimento).getTime() < in30Days
  );
  const viagensAtivas = trips.filter(
    t => t.status === "em_andamento" || t.status === "planejada"
  );
  const manutencoesPendentes = maintenances.filter(
    m => m.status === "pendente" || m.status === "em_andamento"
  );

  const lines: string[] = [];
  lines.push(`Data de hoje: ${new Date(now).toLocaleDateString("pt-BR")}.`);
  lines.push(
    `Frota: ${vehicles.length} veículos (ativos: ${fleetByStatus.ativo}, em manutenção: ${fleetByStatus.manutencao}, inativos: ${fleetByStatus.inativo}).`
  );
  lines.push(`Motoristas: ${drivers.length}.`);
  lines.push(
    `Viagens: ${trips.length} no total, ${viagensAtivas.length} ativas (planejada/em andamento).`
  );
  lines.push(
    `CNHs vencendo em até 30 dias (${cnhVencendo.length}): ` +
      (cnhVencendo.map(d => `${d.nome} (${fmt(d.cnhVencimento)})`).join("; ") ||
        "nenhuma")
  );
  lines.push(
    `CRLVs vencendo em até 30 dias (${crlvVencendo.length}): ` +
      (crlvVencendo
        .map(v => `${v.placa} (${fmt(v.crlvVencimento)})`)
        .join("; ") || "nenhum")
  );
  lines.push(
    `Manutenções pendentes (${manutencoesPendentes.length}): ` +
      (manutencoesPendentes
        .map(m => {
          const veic = vehicles.find(v => v.id === m.veiculoId);
          return `${veic?.placa ?? "?"} - ${m.tipo} (prevista ${fmt(m.dataPrevista)})`;
        })
        .join("; ") || "nenhuma")
  );
  return lines.join("\n");
}

const FLEET_ASSISTANT_SYSTEM = `Você é o assistente de frota do sistema Frapto Transp.
Responda em português do Brasil, de forma objetiva e útil, sobre gestão de frota:
veículos, motoristas, viagens, manutenções, documentos (CNH/CRLV) e finanças.
Baseie-se SOMENTE nos dados de contexto fornecidos abaixo. Se a informação não
estiver no contexto, diga que não tem esse dado — nunca invente números.

DADOS ATUAIS DA FROTA:
`;

// Config de IA da organização; fallback pro ANTHROPIC_API_KEY do ambiente.
async function resolveAiConfig(orgId: number): Promise<AiRuntimeConfig | null> {
  const cfg = await getAiConfig(orgId);
  if (cfg && cfg.enabled && cfg.apiKey) {
    return {
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model ?? "",
      baseUrl: cfg.baseUrl,
    };
  }
  if (ENV.anthropicApiKey) {
    return {
      provider: "anthropic",
      apiKey: ENV.anthropicApiKey,
      model: "claude-haiku-4-5",
      baseUrl: null,
    };
  }
  return null;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
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
          password: z
            .string()
            .min(8, "A senha precisa de ao menos 8 caracteres"),
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
  }),

  // Cobrança/assinatura (Stripe). Acessível mesmo sem assinatura ativa,
  // pra que o usuário logado consiga pagar e liberar o sistema.
  billing: router({
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
  }),

  // Assistente de IA de frota. Somente leitura — informa, não muta.
  ai: router({
    chat: activeOrgProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const cfg = await resolveAiConfig(ctx.orgId);
        if (!cfg) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Assistente de IA não configurado. Configure o provedor e a chave em Configurações.",
          });
        }
        const context = await buildFleetContext(ctx.orgId);
        const messages: ChatMessage[] = input.messages.map(m => ({
          role: m.role,
          content: sanitizeChatContent(m.content),
        }));
        const response = await invokeLLM(cfg, {
          system: FLEET_ASSISTANT_SYSTEM + context,
          messages,
        });
        return { response };
      }),
  }),

  // Configurações (dono da org). A chave da IA nunca volta ao browser.
  settings: router({
    getAiConfig: orgOwnerProcedure.query(async ({ ctx }) => {
      const cfg = await getAiConfig(ctx.orgId);
      return {
        provider: cfg?.provider ?? ("anthropic" as const),
        model: cfg?.model ?? "",
        baseUrl: cfg?.baseUrl ?? "",
        enabled: cfg?.enabled ?? false,
        hasKey: Boolean(cfg?.apiKey),
        keyPreview: cfg?.apiKey ? `••••${cfg.apiKey.slice(-4)}` : "",
      };
    }),

    updateAiConfig: orgOwnerProcedure
      .input(
        z.object({
          provider: z.enum(["anthropic", "openai", "openai_compatible"]),
          model: z.string().optional(),
          baseUrl: z.string().optional(),
          apiKey: z.string().optional(),
          enabled: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const data: {
          provider: "anthropic" | "openai" | "openai_compatible";
          model: string | null;
          baseUrl: string | null;
          enabled: boolean;
          apiKey?: string;
        } = {
          provider: input.provider,
          model: input.model?.trim() || null,
          baseUrl: input.baseUrl?.trim() || null,
          enabled: input.enabled,
        };
        // Anti-SSRF: a Base URL custom (openai_compatible) não pode apontar para
        // endereço interno/loopback/metadata.
        if (input.provider === "openai_compatible" && data.baseUrl) {
          try {
            await assertSafeBaseUrl(data.baseUrl);
          } catch (e) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: e instanceof Error ? e.message : "Base URL inválida.",
            });
          }
        }
        if (input.apiKey && input.apiKey.trim().length > 0) {
          data.apiKey = input.apiKey.trim();
        }
        await upsertAiConfig(ctx.orgId, data);
        return { success: true } as const;
      }),
  }),

  // ─── Veículos ──────────────────────────────────────────────────────────────
  vehicles: router({
    list: activeOrgProcedure.query(({ ctx }) => getVehicles(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getVehicleById(ctx.orgId, input.id)),

    create: activeOrgProcedure
      .input(
        z.object({
          placa: z.string().min(1),
          marca: z.string().min(1),
          modelo: z.string().min(1),
          ano: z.number(),
          tipo: z.enum(["caminhao", "van", "onibus", "carro"]),
          capacidadeCarga: z.string().optional(),
          crlvVencimento: z.date().optional(),
          seguroVencimento: z.date().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createVehicle(ctx.orgId, {
          placa: input.placa,
          marca: input.marca,
          modelo: input.modelo,
          ano: input.ano,
          tipo: input.tipo,
          status: "ativo",
          quilometragem: 0,
          capacidadeCarga: parseNumericString(input.capacidadeCarga),
          crlvVencimento: input.crlvVencimento || null,
          seguroVencimento: input.seguroVencimento || null,
          observacoes: input.observacoes || null,
        })
      ),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          placa: z.string().optional(),
          marca: z.string().optional(),
          modelo: z.string().optional(),
          ano: z.number().optional(),
          tipo: z.enum(["caminhao", "van", "onibus", "carro"]).optional(),
          status: z.enum(["ativo", "manutencao", "inativo"]).optional(),
          capacidadeCarga: z.string().optional(),
          crlvVencimento: z.date().optional(),
          seguroVencimento: z.date().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, capacidadeCarga, ...rest } = input;
        const updateData: Partial<InsertVehicle> = { ...rest };
        if (capacidadeCarga !== undefined) {
          updateData.capacidadeCarga = parseNumericString(capacidadeCarga);
        }
        return updateVehicle(ctx.orgId, id, updateData);
      }),

    delete: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteVehicle(ctx.orgId, input.id)),
  }),

  // ─── Motoristas ──────────────────────────────────────────────────────────────
  drivers: router({
    list: activeOrgProcedure.query(({ ctx }) => getDrivers(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getDriverById(ctx.orgId, input.id)),

    create: activeOrgProcedure
      .input(
        z.object({
          nome: z.string().min(1),
          cpf: z.string().min(11),
          email: z.string().email().optional(),
          telefone: z.string().optional(),
          cnh: z.string().min(1),
          cnhCategoria: z.string().min(1),
          cnhVencimento: z.date(),
          endereco: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createDriver(ctx.orgId, {
          nome: input.nome,
          cpf: input.cpf,
          email: input.email || null,
          telefone: input.telefone || null,
          cnh: input.cnh,
          cnhCategoria: input.cnhCategoria,
          cnhVencimento: input.cnhVencimento,
          status: "disponivel",
          disponibilidade: true,
          dataAdmissao: new Date(),
          endereco: input.endereco || null,
          observacoes: input.observacoes || null,
        })
      ),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          nome: z.string().optional(),
          cpf: z.string().optional(),
          email: z.string().optional(),
          telefone: z.string().optional(),
          cnh: z.string().optional(),
          cnhCategoria: z.string().optional(),
          cnhVencimento: z.date().optional(),
          status: z
            .enum(["disponivel", "viagem", "descansando", "inativo"])
            .optional(),
          disponibilidade: z.boolean().optional(),
          endereco: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...rest } = input;
        return updateDriver(ctx.orgId, id, rest);
      }),

    delete: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteDriver(ctx.orgId, input.id)),
  }),

  // ─── Viagens ─────────────────────────────────────────────────────────────────
  trips: router({
    list: activeOrgProcedure.query(({ ctx }) => getTrips(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getTripById(ctx.orgId, input.id)),

    create: activeOrgProcedure
      .input(
        z.object({
          numeroViagem: z.string().min(1),
          motoristaId: z.number(),
          veiculoId: z.number(),
          origem: z.string().min(1),
          destino: z.string().min(1),
          dataPartida: z.date(),
          distancia: z.string().optional(),
          carga: z.string().optional(),
          pesoTotal: z.string().optional(),
          valor: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertRefsOwned(ctx.orgId, {
          veiculoId: input.veiculoId,
          motoristaId: input.motoristaId,
        });
        return createTrip(ctx.orgId, {
          numeroViagem: input.numeroViagem,
          motoristaId: input.motoristaId,
          veiculoId: input.veiculoId,
          origem: input.origem,
          destino: input.destino,
          dataPartida: input.dataPartida,
          status: "planejada",
          distancia: parseNumericString(input.distancia),
          carga: input.carga || null,
          pesoTotal: parseNumericString(input.pesoTotal),
          valor: parseNumericString(input.valor),
          observacoes: input.observacoes || null,
        });
      }),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          numeroViagem: z.string().optional(),
          motoristaId: z.number().optional(),
          veiculoId: z.number().optional(),
          origem: z.string().optional(),
          destino: z.string().optional(),
          dataPartida: z.date().optional(),
          dataChegada: z.date().optional(),
          status: z
            .enum(["planejada", "em_andamento", "concluida", "cancelada"])
            .optional(),
          distancia: z.string().optional(),
          carga: z.string().optional(),
          pesoTotal: z.string().optional(),
          valor: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertRefsOwned(ctx.orgId, {
          veiculoId: input.veiculoId,
          motoristaId: input.motoristaId,
        });
        const { id, distancia, pesoTotal, valor, ...rest } = input;
        const updateData: Partial<InsertTrip> = { ...rest };
        if (distancia !== undefined)
          updateData.distancia = parseNumericString(distancia);
        if (pesoTotal !== undefined)
          updateData.pesoTotal = parseNumericString(pesoTotal);
        if (valor !== undefined) updateData.valor = parseNumericString(valor);
        return updateTrip(ctx.orgId, id, updateData);
      }),

    delete: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteTrip(ctx.orgId, input.id)),

    updateStatus: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum([
            "planejada",
            "em_andamento",
            "concluida",
            "cancelada",
          ]),
          dataChegada: z.date().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const updateData: Partial<InsertTrip> = { status: input.status };
        if (input.dataChegada) updateData.dataChegada = input.dataChegada;
        return updateTrip(ctx.orgId, input.id, updateData);
      }),
  }),

  // ─── Manutenção ──────────────────────────────────────────────────────────────
  maintenance: router({
    list: activeOrgProcedure.query(({ ctx }) => getMaintenances(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getMaintenanceById(ctx.orgId, input.id)),

    getByVehicle: activeOrgProcedure
      .input(z.object({ veiculoId: z.number() }))
      .query(({ ctx, input }) =>
        getMaintenancesByVehicle(ctx.orgId, input.veiculoId)
      ),

    create: activeOrgProcedure
      .input(
        z.object({
          veiculoId: z.number(),
          tipo: z.string().min(1),
          descricao: z.string().min(1),
          dataPrevista: z.date(),
          custo: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertRefsOwned(ctx.orgId, { veiculoId: input.veiculoId });
        return createMaintenance(ctx.orgId, {
          veiculoId: input.veiculoId,
          tipo: input.tipo,
          descricao: input.descricao,
          dataPrevista: input.dataPrevista,
          custo: parseNumericString(input.custo),
          status: "pendente",
          observacoes: input.observacoes || null,
        });
      }),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          tipo: z.string().optional(),
          descricao: z.string().optional(),
          dataPrevista: z.date().optional(),
          dataRealizada: z.date().optional(),
          custo: z.string().optional(),
          status: z.enum(["pendente", "em_andamento", "concluida"]).optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, custo, ...rest } = input;
        const updateData: Partial<InsertMaintenance> = { ...rest };
        if (custo !== undefined) updateData.custo = parseNumericString(custo);
        return updateMaintenance(ctx.orgId, id, updateData);
      }),

    updateStatus: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pendente", "em_andamento", "concluida"]),
          dataRealizada: z.date().optional(),
          custo: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, custo, ...rest } = input;
        const updateData: Partial<InsertMaintenance> = { ...rest };
        if (custo !== undefined) updateData.custo = parseNumericString(custo);
        return updateMaintenance(ctx.orgId, id, updateData);
      }),
  }),

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: router({
    stats: activeOrgProcedure.query(async ({ ctx }) => {
      const [vehiclesList, driversList, tripsList, maintenanceList] =
        await Promise.all([
          getVehicles(ctx.orgId),
          getDrivers(ctx.orgId),
          getTrips(ctx.orgId),
          getMaintenances(ctx.orgId),
        ]);

      const fleetStatus = {
        ativo: vehiclesList.filter(v => v.status === "ativo").length,
        manutencao: vehiclesList.filter(v => v.status === "manutencao").length,
        inativo: vehiclesList.filter(v => v.status === "inativo").length,
      };

      const last6Months = Array.from({ length: 6 })
        .map((_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthName = date.toLocaleString("pt-BR", { month: "short" });
          const count = tripsList.filter(t => {
            const tripDate = new Date(t.dataPartida);
            return (
              tripDate.getMonth() === date.getMonth() &&
              tripDate.getFullYear() === date.getFullYear()
            );
          }).length;
          return { month: monthName, count };
        })
        .reverse();

      const alerts = [
        ...maintenanceList
          .filter(
            m =>
              m.status === "pendente" &&
              new Date(m.dataPrevista) <
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          )
          .map(m => ({
            type: "manutencao",
            title: "Manutenção Próxima",
            message: `Veículo ${vehiclesList.find(v => v.id === m.veiculoId)?.placa} tem manutenção agendada para ${new Date(m.dataPrevista).toLocaleDateString("pt-BR")}`,
            urgency: "alta",
          })),
        ...vehiclesList
          .filter(
            v =>
              v.crlvVencimento &&
              new Date(v.crlvVencimento) <
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          )
          .map(v => ({
            type: "documento",
            title: "CRLV Vencendo",
            message: `O CRLV do veículo ${v.placa} vence em ${new Date(v.crlvVencimento!).toLocaleDateString("pt-BR")}`,
            urgency: "media",
          })),
        ...driversList
          .filter(
            d =>
              d.cnhVencimento &&
              new Date(d.cnhVencimento) <
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          )
          .map(d => ({
            type: "cnh",
            title: "CNH Vencendo",
            message: `A CNH do motorista ${d.nome} vence em ${new Date(d.cnhVencimento!).toLocaleDateString("pt-BR")}`,
            urgency: "media",
          })),
      ];

      return {
        totalVehicles: vehiclesList.length,
        totalDrivers: driversList.length,
        totalTrips: tripsList.length,
        tripsByMonth: last6Months,
        fleetStatus,
        alerts: alerts.slice(0, 10),
      };
    }),
  }),

  // ─── Despesas ────────────────────────────────────────────────────────────────
  expenses: router({
    list: activeOrgProcedure.query(({ ctx }) => getExpenses(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getExpenseById(ctx.orgId, input.id)),

    create: activeOrgProcedure
      .input(
        z.object({
          tipo: z.enum([
            "combustivel",
            "manutencao",
            "pedagio",
            "seguro",
            "salario",
            "outros",
          ]),
          descricao: z.string().min(1),
          valor: z.string().min(1),
          data: z.date(),
          veiculoId: z.number().optional(),
          motoristId: z.number().optional(),
          viagemId: z.number().optional(),
          categoria: z.string().optional(),
          formaPagamento: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertRefsOwned(ctx.orgId, {
          veiculoId: input.veiculoId,
          motoristaId: input.motoristId,
          viagemId: input.viagemId,
        });
        return createExpense(ctx.orgId, {
          tipo: input.tipo,
          descricao: input.descricao,
          valor: parseRequiredNumericString(input.valor),
          data: input.data,
          veiculoId: input.veiculoId || null,
          motoristId: input.motoristId || null,
          viagemId: input.viagemId || null,
          categoria: input.categoria || null,
          formaPagamento: input.formaPagamento || null,
          observacoes: input.observacoes || null,
        });
      }),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          tipo: z
            .enum([
              "combustivel",
              "manutencao",
              "pedagio",
              "seguro",
              "salario",
              "outros",
            ])
            .optional(),
          descricao: z.string().optional(),
          valor: z.string().optional(),
          data: z.date().optional(),
          veiculoId: z.number().optional(),
          motoristId: z.number().optional(),
          viagemId: z.number().optional(),
          categoria: z.string().optional(),
          formaPagamento: z.string().optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, valor, ...rest } = input;
        const updateData: Partial<InsertExpense> = { ...rest };
        if (valor !== undefined)
          updateData.valor = parseRequiredNumericString(valor);
        return updateExpense(ctx.orgId, id, updateData);
      }),

    delete: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteExpense(ctx.orgId, input.id)),
  }),

  // ─── Receitas ────────────────────────────────────────────────────────────────
  revenues: router({
    list: activeOrgProcedure.query(({ ctx }) => getRevenues(ctx.orgId)),

    getById: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getRevenueById(ctx.orgId, input.id)),

    create: activeOrgProcedure
      .input(
        z.object({
          tipo: z.enum(["viagem", "frete", "servico", "outros"]),
          descricao: z.string().min(1),
          valor: z.string().min(1),
          data: z.date(),
          viagemId: z.number().optional(),
          clienteNome: z.string().optional(),
          clienteCpfCnpj: z.string().optional(),
          formaPagamento: z.string().optional(),
          status: z.enum(["pendente", "recebido", "cancelado"]).optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertRefsOwned(ctx.orgId, { viagemId: input.viagemId });
        return createRevenue(ctx.orgId, {
          tipo: input.tipo,
          descricao: input.descricao,
          valor: parseRequiredNumericString(input.valor),
          data: input.data,
          viagemId: input.viagemId || null,
          clienteNome: input.clienteNome || null,
          clienteCpfCnpj: input.clienteCpfCnpj || null,
          formaPagamento: input.formaPagamento || null,
          status: input.status || "pendente",
          observacoes: input.observacoes || null,
        });
      }),

    update: activeOrgProcedure
      .input(
        z.object({
          id: z.number(),
          tipo: z.enum(["viagem", "frete", "servico", "outros"]).optional(),
          descricao: z.string().optional(),
          valor: z.string().optional(),
          data: z.date().optional(),
          viagemId: z.number().optional(),
          clienteNome: z.string().optional(),
          clienteCpfCnpj: z.string().optional(),
          formaPagamento: z.string().optional(),
          status: z.enum(["pendente", "recebido", "cancelado"]).optional(),
          observacoes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, valor, ...rest } = input;
        const updateData: Partial<InsertRevenue> = { ...rest };
        if (valor !== undefined)
          updateData.valor = parseRequiredNumericString(valor);
        return updateRevenue(ctx.orgId, id, updateData);
      }),

    delete: activeOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteRevenue(ctx.orgId, input.id)),
  }),
});

export type AppRouter = typeof appRouter;
