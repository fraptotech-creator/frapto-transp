import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
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
  getNotifications,
  createNotification,
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
} from "./db";
import { TRPCError } from "@trpc/server";
import { invokeLLM, type ChatMessage } from "./_core/llm";
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

// Para campos numéricos OBRIGATÓRIOS (ex.: valor de despesa/receita, notNull no
// schema). Falha fechado: entrada não-numérica vira erro de validação visível,
// em vez de null que estouraria no banco.
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

// Monta um resumo textual do estado real da frota para dar contexto ao assistente.
// Função de leitura: o assistente informa; nunca muta dados.
async function buildFleetContext(): Promise<string> {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const [vehicles, drivers, trips, maintenances] = await Promise.all([
    getVehicles(),
    getDrivers(),
    getTrips(),
    getMaintenances(),
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Assistente de IA de frota (Claude). Somente leitura — informa, não muta.
  ai: router({
    chat: protectedProcedure
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
      .mutation(async ({ input }) => {
        const context = await buildFleetContext();
        const messages: ChatMessage[] = input.messages.map(m => ({
          role: m.role,
          content: m.content,
        }));
        const response = await invokeLLM({
          system: FLEET_ASSISTANT_SYSTEM + context,
          messages,
        });
        return { response };
      }),
  }),

  // Procedures para Veículos
  vehicles: router({
    list: protectedProcedure.query(async () => {
      return getVehicles();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getVehicleById(input.id);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createVehicle({
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
        });
      }),

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, capacidadeCarga, ...rest } = input;
        const updateData: Partial<InsertVehicle> = {
          ...rest,
        };
        if (capacidadeCarga !== undefined) {
          updateData.capacidadeCarga = parseNumericString(capacidadeCarga);
        }
        return updateVehicle(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteVehicle(input.id);
      }),
  }),

  // Procedures para Motoristas
  drivers: router({
    list: protectedProcedure.query(async () => {
      return getDrivers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getDriverById(input.id);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createDriver({
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
        });
      }),

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        return updateDriver(id, rest);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteDriver(input.id);
      }),
  }),

  // Procedures para Viagens
  trips: router({
    list: protectedProcedure.query(async () => {
      return getTrips();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getTripById(input.id);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createTrip({
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

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, distancia, pesoTotal, valor, ...rest } = input;
        const updateData: Partial<InsertTrip> = {
          ...rest,
        };
        if (distancia !== undefined) {
          updateData.distancia = parseNumericString(distancia);
        }
        if (pesoTotal !== undefined) {
          updateData.pesoTotal = parseNumericString(pesoTotal);
        }
        if (valor !== undefined) {
          updateData.valor = parseNumericString(valor);
        }
        return updateTrip(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteTrip(input.id);
      }),

    updateStatus: protectedProcedure
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
      .mutation(async ({ input }) => {
        const updateData: Partial<InsertTrip> = {
          status: input.status,
        };
        if (input.dataChegada) {
          updateData.dataChegada = input.dataChegada;
        }
        return updateTrip(input.id, updateData);
      }),
  }),

  // Procedures para Manutenção
  maintenance: router({
    list: protectedProcedure.query(async () => {
      return getMaintenances();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getMaintenanceById(input.id);
      }),

    getByVehicle: protectedProcedure
      .input(z.object({ veiculoId: z.number() }))
      .query(async ({ input }) => {
        return getMaintenancesByVehicle(input.veiculoId);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createMaintenance({
          veiculoId: input.veiculoId,
          tipo: input.tipo,
          descricao: input.descricao,
          dataPrevista: input.dataPrevista,
          custo: parseNumericString(input.custo),
          status: "pendente",
          observacoes: input.observacoes || null,
        });
      }),

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, custo, ...rest } = input;
        const updateData: Partial<InsertMaintenance> = {
          ...rest,
        };
        if (custo !== undefined) {
          updateData.custo = parseNumericString(custo);
        }
        return updateMaintenance(id, updateData);
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pendente", "em_andamento", "concluida"]),
          dataRealizada: z.date().optional(),
          custo: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, custo, ...rest } = input;
        const updateData: Partial<InsertMaintenance> = {
          ...rest,
        };
        if (custo !== undefined) {
          updateData.custo = parseNumericString(custo);
        }
        return updateMaintenance(id, updateData);
      }),
  }),

  // Procedures para Dashboard
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const [vehiclesList, driversList, tripsList, maintenanceList] =
        await Promise.all([
          getVehicles(),
          getDrivers(),
          getTrips(),
          getMaintenances(),
        ]);

      // Calcular estatísticas básicas
      const fleetStatus = {
        ativo: vehiclesList.filter(v => v.status === "ativo").length,
        manutencao: vehiclesList.filter(v => v.status === "manutencao").length,
        inativo: vehiclesList.filter(v => v.status === "inativo").length,
      };

      // Viagens por mês (últimos 6 meses)
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

      // Alertas (manutenções próximas, documentos vencendo)
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
        tripsByMonth: last6Months.map(m => ({
          month: m.month,
          count: m.count,
        })),
        fleetStatus,
        alerts: alerts.slice(0, 10), // Limitar a 10 alertas
      };
    }),
  }),

  // Procedures para Despesas
  expenses: router({
    list: protectedProcedure.query(async () => {
      return getExpenses();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getExpenseById(input.id);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createExpense({
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

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, valor, ...rest } = input;
        const updateData: Partial<InsertExpense> = { ...rest };
        if (valor !== undefined) {
          updateData.valor = parseRequiredNumericString(valor);
        }
        return updateExpense(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteExpense(input.id);
      }),
  }),

  // Procedures para Receitas
  revenues: router({
    list: protectedProcedure.query(async () => {
      return getRevenues();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getRevenueById(input.id);
      }),

    create: protectedProcedure
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
      .mutation(async ({ input }) => {
        return createRevenue({
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

    update: protectedProcedure
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
      .mutation(async ({ input }) => {
        const { id, valor, ...rest } = input;
        const updateData: Partial<InsertRevenue> = { ...rest };
        if (valor !== undefined) {
          updateData.valor = parseRequiredNumericString(valor);
        }
        return updateRevenue(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteRevenue(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
