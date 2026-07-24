import { z } from "zod";
import { activeOrgProcedure, router } from "../_core/trpc";
import {
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
} from "../db";
import type { InsertExpense, InsertRevenue } from "../../drizzle/schema";
import { parseRequiredNumericString, assertRefsOwned } from "./_helpers";

export const expensesRouter = router({
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
    .mutation(async ({ ctx, input }) => {
      // Revalida posse na EDIÇÃO também: sem isto, um PATCH podia apontar a
      // despesa para veículo/motorista/viagem de OUTRA org (referência órfã
      // cross-tenant). O create já valida; o update precisava do mesmo gate.
      await assertRefsOwned(ctx.orgId, {
        veiculoId: input.veiculoId,
        motoristaId: input.motoristId,
        viagemId: input.viagemId,
      });
      const { id, valor, ...rest } = input;
      const updateData: Partial<InsertExpense> = { ...rest };
      if (valor !== undefined)
        updateData.valor = parseRequiredNumericString(valor);
      return updateExpense(ctx.orgId, id, updateData);
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteExpense(ctx.orgId, input.id)),
});

export const revenuesRouter = router({
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
    .mutation(async ({ ctx, input }) => {
      // Revalida posse da viagem na EDIÇÃO (mesmo motivo do expense.update):
      // impede repontar a receita para uma viagem de outra org.
      await assertRefsOwned(ctx.orgId, { viagemId: input.viagemId });
      const { id, valor, ...rest } = input;
      const updateData: Partial<InsertRevenue> = { ...rest };
      if (valor !== undefined)
        updateData.valor = parseRequiredNumericString(valor);
      return updateRevenue(ctx.orgId, id, updateData);
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteRevenue(ctx.orgId, input.id)),
});
