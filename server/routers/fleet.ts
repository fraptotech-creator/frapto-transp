import { z } from "zod";
import { activeOrgProcedure, router } from "../_core/trpc";
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
  getMaintenances,
  getMaintenanceById,
  getMaintenancesByVehicle,
  createMaintenance,
  updateMaintenance,
} from "../db";
import type {
  InsertVehicle,
  InsertDriver,
  InsertTrip,
  InsertMaintenance,
} from "../../drizzle/schema";
import { parseNumericString, assertRefsOwned } from "./_helpers";
import {
  onlyDigits,
  normalizePlaca,
  normalizeOptionalPhone,
} from "../_core/normalize";

export const vehiclesRouter = router({
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
        placa: normalizePlaca(input.placa),
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
      if (rest.placa !== undefined) {
        updateData.placa = normalizePlaca(rest.placa);
      }
      return updateVehicle(ctx.orgId, id, updateData);
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteVehicle(ctx.orgId, input.id)),
});

export const driversRouter = router({
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
        cpf: onlyDigits(input.cpf),
        email: input.email || null,
        telefone: normalizeOptionalPhone(input.telefone),
        cnh: onlyDigits(input.cnh),
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
      const updateData: Partial<InsertDriver> = { ...rest };
      // Normaliza os campos de identidade quando enviados (dígitos apenas).
      if (rest.cpf !== undefined) updateData.cpf = onlyDigits(rest.cpf);
      if (rest.cnh !== undefined) updateData.cnh = onlyDigits(rest.cnh);
      if (rest.telefone !== undefined) {
        updateData.telefone = normalizeOptionalPhone(rest.telefone);
      }
      return updateDriver(ctx.orgId, id, updateData);
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDriver(ctx.orgId, input.id)),
});

export const tripsRouter = router({
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
        status: z.enum(["planejada", "em_andamento", "concluida", "cancelada"]),
        dataChegada: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const updateData: Partial<InsertTrip> = { status: input.status };
      if (input.dataChegada) updateData.dataChegada = input.dataChegada;
      return updateTrip(ctx.orgId, input.id, updateData);
    }),
});

export const maintenanceRouter = router({
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
});

export const dashboardRouter = router({
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
});
