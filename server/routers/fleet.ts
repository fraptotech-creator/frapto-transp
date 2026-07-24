import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { activeOrgProcedure, router } from "../_core/trpc";
import { gerarTokenReset, expiraEmAtivacao } from "../_core/passwordReset";
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
  createDriverUser,
  getUserByUsername,
  getDriverUser,
  setUserPassword,
  setUsername,
  deleteDriverUser,
  incrementSessionVersion,
  setDriverTrackingToken,
  setResetToken,
  getTrips,
  getTripById,
  getTripPositions,
  createTrip,
  updateTrip,
  deleteTrip,
  getMaintenances,
  getMaintenanceById,
  getMaintenancesByVehicle,
  createMaintenance,
  updateMaintenance,
  accrueTripKm,
  resetOilChange,
  getExpenses,
  getRevenues,
} from "../db";
import { isOilChange, computeOilStatus } from "../_core/oil";
import {
  computeFinanceSummary,
  computeMonthlySeries,
  computeFinanceLedger,
} from "../_core/finance";
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
import { transicaoValida, type TripStatus } from "../_core/tripState";
import { downsampleEvenly } from "../_core/tracking";

// Carrega a viagem e valida a transição de status pedida. Fail-closed:
// viagem inexistente → NOT_FOUND; transição ilícita (pulo/reversão/terminal)
// → BAD_REQUEST. Devolve a viagem atual (evita um segundo getTripById).
async function assertTripTransition(
  orgId: number,
  tripId: number,
  novoStatus: TripStatus | undefined
) {
  const trip = await getTripById(orgId, tripId);
  if (!trip) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Viagem não encontrada.",
    });
  }
  if (
    novoStatus !== undefined &&
    !transicaoValida(trip.status as TripStatus, novoStatus)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Transição de status inválida: ${trip.status} → ${novoStatus}.`,
    });
  }
  return trip;
}

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
        quilometragem: z.number().int().min(0).optional(),
        intervaloTrocaOleoKm: z.number().int().min(0).optional(),
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
        quilometragem: input.quilometragem ?? 0,
        intervaloTrocaOleoKm: input.intervaloTrocaOleoKm || 10000,
        // Veículo novo: assume óleo em dia → conta a partir do km inicial.
        kmUltimaTrocaOleo: input.quilometragem ?? 0,
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
        quilometragem: z.number().int().min(0).optional(),
        intervaloTrocaOleoKm: z.number().int().min(0).optional(),
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

// Senha inicial do motorista: ALEATÓRIA por motorista (não mais a constante
// "123456" compartilhada — que era previsível e igual p/ todos). Mostrada UMA
// vez ao admin no cadastro/reset; troca obrigatória no 1º acesso.
// Senha interna aleatória e DESCARTÁVEL: a conta nasce sem senha utilizável e
// travada (mustChangePassword). Não é mostrada a ninguém — o motorista define a
// própria senha pelo link de ativação. Substitui o antigo fluxo que devolvia a
// senha em texto para o gestor colar no WhatsApp.
function genThrowawayPassword(): string {
  return randomBytes(24).toString("hex");
}

// Emite um token de ativação de USO ÚNICO (hash no banco) para o motorista
// definir a própria senha via /redefinir-senha. Devolve o token (não-secreto o
// suficiente para virar link; expira em 7 dias e é revogável).
async function emitirTokenAtivacao(openId: string): Promise<string> {
  const { token, hash } = gerarTokenReset();
  await setResetToken(openId, hash, expiraEmAtivacao(new Date()));
  return token;
}

// O trackingToken é uma CREDENCIAL bearer (posta em /api/track sem cookie) —
// vive só no aparelho do motorista. NUNCA deve ir pro browser da gestão. Strip
// antes de devolver ao cliente (o app do motorista lê o token por caminho
// próprio: ensureTrackingToken / /api/track/login).
function stripDriverSecret<T extends { trackingToken?: string | null }>(
  d: T
): Omit<T, "trackingToken"> {
  const { trackingToken: _omit, ...rest } = d;
  return rest;
}

export const driversRouter = router({
  list: activeOrgProcedure.query(async ({ ctx }) =>
    (await getDrivers(ctx.orgId)).map(stripDriverSecret)
  ),

  getById: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const d = await getDriverById(ctx.orgId, input.id);
      return d ? stripDriverSecret(d) : d;
    }),

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
        // Login do motorista (usuário; senha inicial é a padrão).
        username: z.string().min(3).max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase().trim();
      // Confere disponibilidade ANTES de criar o motorista (evita órfão).
      if (await getUserByUsername(username)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esse usuário já está em uso. Escolha outro.",
        });
      }
      const driver = await createDriver(ctx.orgId, {
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
      });
      if (!driver) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao cadastrar motorista.",
        });
      }
      const openId = `driver_${randomBytes(16).toString("hex")}`;
      try {
        const passwordHash = await bcrypt.hash(genThrowawayPassword(), 10);
        await createDriverUser({
          orgId: ctx.orgId,
          driverId: driver.id,
          openId,
          username,
          passwordHash,
          name: input.nome,
        });
      } catch (e) {
        // Falhou o login (ex.: corrida de username) → desfaz o motorista.
        await deleteDriver(ctx.orgId, driver.id);
        throw e;
      }
      // Devolve o TOKEN de ativação (não a senha): o gestor compartilha um link
      // de uso único para o motorista criar a própria senha.
      const activationToken = await emitirTokenAtivacao(openId);
      return { ...stripDriverSecret(driver), username, activationToken };
    }),

  // Informa o usuário (apelido) de login do motorista, se já houver.
  loginInfo: activeOrgProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await getDriverUser(ctx.orgId, input.driverId);
      return { username: user?.username ?? null, hasLogin: !!user };
    }),

  // Define/renomeia o usuário de acesso do motorista. Se ainda não tem login,
  // CRIA o acesso (senha inicial padrão, troca obrigatória). Serve para dar
  // acesso a motoristas cadastrados antes do recurso existir.
  setLogin: activeOrgProcedure
    .input(
      z.object({ driverId: z.number(), username: z.string().min(3).max(64) })
    )
    .mutation(async ({ ctx, input }) => {
      const driver = await getDriverById(ctx.orgId, input.driverId);
      if (!driver) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Motorista não encontrado.",
        });
      }
      const username = input.username.toLowerCase().trim();
      // Usuário já usado por OUTRO login?
      const taken = await getUserByUsername(username);
      const current = await getDriverUser(ctx.orgId, input.driverId);
      if (taken && taken.driverId !== input.driverId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esse usuário já está em uso. Escolha outro.",
        });
      }
      if (current) {
        await setUsername(current.openId, username);
        return { created: false } as const;
      }
      const openId = `driver_${randomBytes(16).toString("hex")}`;
      const passwordHash = await bcrypt.hash(genThrowawayPassword(), 10);
      await createDriverUser({
        orgId: ctx.orgId,
        driverId: input.driverId,
        openId,
        username,
        passwordHash,
        name: driver.nome,
      });
      const activationToken = await emitirTokenAtivacao(openId);
      return { created: true, activationToken } as const;
    }),

  // Admin reseta a senha do motorista para a padrão (e o obriga a trocar);
  // derruba qualquer sessão ativa dele.
  resetPassword: activeOrgProcedure
    .input(z.object({ driverId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDriverUser(ctx.orgId, input.driverId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este motorista não tem login.",
        });
      }
      // Zera a senha para um valor descartável + trava a conta, e emite um
      // token de ativação. O motorista define a nova senha pelo link; nada em
      // texto trafega.
      const hash = await bcrypt.hash(genThrowawayPassword(), 10);
      await setUserPassword(user.openId, hash, true);
      await incrementSessionVersion(user.openId);
      // Rotaciona (anula) o token de rastreio: mata o acesso do aparelho antigo
      // ao /api/track; no próximo login o app gera um token novo.
      await setDriverTrackingToken(ctx.orgId, input.driverId, null);
      const activationToken = await emitirTokenAtivacao(user.openId);
      return { activationToken } as const;
    }),

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
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const updateData: Partial<InsertDriver> = { ...rest };
      // Normaliza os campos de identidade quando enviados (dígitos apenas).
      if (rest.cpf !== undefined) updateData.cpf = onlyDigits(rest.cpf);
      if (rest.cnh !== undefined) updateData.cnh = onlyDigits(rest.cnh);
      if (rest.telefone !== undefined) {
        updateData.telefone = normalizeOptionalPhone(rest.telefone);
      }
      const d = await updateDriver(ctx.orgId, id, updateData);
      return d ? stripDriverSecret(d) : d;
    }),

  delete: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Apaga também o login vinculado (se houver).
      await deleteDriverUser(ctx.orgId, input.id);
      return deleteDriver(ctx.orgId, input.id);
    }),
});

export const tripsRouter = router({
  list: activeOrgProcedure.query(({ ctx }) => getTrips(ctx.orgId)),

  getById: activeOrgProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getTripById(ctx.orgId, input.id)),

  // Trajeto rastreado (posições GPS enviadas pelo celular do motorista).
  // Reamostra para no máximo WIRE_MAX pontos: o traçado no mapa fica idêntico
  // e o payload não explode em viagens longas (o banco já capa em 20k linhas).
  positions: activeOrgProcedure
    .input(z.object({ tripId: z.number() }))
    .query(async ({ ctx, input }) => {
      const WIRE_MAX = 2000;
      const rows = await getTripPositions(ctx.orgId, input.tripId);
      return downsampleEvenly(rows, WIRE_MAX);
    }),

  create: activeOrgProcedure
    .input(
      z.object({
        numeroViagem: z.string().min(1),
        motoristaId: z.number(),
        veiculoId: z.number(),
        origem: z.string().min(1),
        destino: z.string().min(1),
        dataPartida: z.date(),
        previsaoChegada: z.date().optional(),
        distancia: z.string().optional(),
        carga: z.string().optional(),
        pesoTotal: z.string().optional(),
        valor: z.string().optional(),
        pago: z.boolean().optional(),
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
        previsaoChegada: input.previsaoChegada ?? null,
        status: "planejada",
        distancia: parseNumericString(input.distancia),
        carga: input.carga || null,
        pesoTotal: parseNumericString(input.pesoTotal),
        valor: parseNumericString(input.valor),
        pago: input.pago ?? false,
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
        previsaoChegada: z.date().optional(),
        dataChegada: z.date().optional(),
        status: z
          .enum(["planejada", "em_andamento", "concluida", "cancelada"])
          .optional(),
        distancia: z.string().optional(),
        carga: z.string().optional(),
        pesoTotal: z.string().optional(),
        valor: z.string().optional(),
        pago: z.boolean().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertRefsOwned(ctx.orgId, {
        veiculoId: input.veiculoId,
        motoristaId: input.motoristaId,
      });
      // Máquina de estados: bloqueia pulo/reversão/mexer em viagem terminal.
      await assertTripTransition(ctx.orgId, input.id, input.status);
      const { id, distancia, pesoTotal, valor, ...rest } = input;
      const updateData: Partial<InsertTrip> = { ...rest };
      if (distancia !== undefined)
        updateData.distancia = parseNumericString(distancia);
      if (pesoTotal !== undefined)
        updateData.pesoTotal = parseNumericString(pesoTotal);
      if (valor !== undefined) updateData.valor = parseNumericString(valor);
      const updated = await updateTrip(ctx.orgId, id, updateData);
      // Concluiu por aqui? soma a distância ao odômetro do veículo (idempotente).
      if (input.status === "concluida") await accrueTripKm(ctx.orgId, id);
      return updated;
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
    .mutation(async ({ ctx, input }) => {
      // Mesma máquina de estados do trips.update.
      await assertTripTransition(ctx.orgId, input.id, input.status);
      const updateData: Partial<InsertTrip> = { status: input.status };
      if (input.dataChegada) updateData.dataChegada = input.dataChegada;
      const trip = await updateTrip(ctx.orgId, input.id, updateData);
      // Ao concluir, soma a distância ao odômetro do veículo (uma vez só).
      if (input.status === "concluida") await accrueTripKm(ctx.orgId, input.id);
      return trip;
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
    .mutation(async ({ ctx, input }) => {
      const { id, custo, ...rest } = input;
      const prev = await getMaintenanceById(ctx.orgId, id);
      const updateData: Partial<InsertMaintenance> = { ...rest };
      if (custo !== undefined) updateData.custo = parseNumericString(custo);
      const updated = await updateMaintenance(ctx.orgId, id, updateData);
      await maybeResetOil(
        ctx.orgId,
        input.status,
        input.tipo ?? prev?.tipo,
        prev
      );
      return updated;
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
    .mutation(async ({ ctx, input }) => {
      const { id, custo, ...rest } = input;
      const prev = await getMaintenanceById(ctx.orgId, id);
      const updateData: Partial<InsertMaintenance> = { ...rest };
      if (custo !== undefined) updateData.custo = parseNumericString(custo);
      const updated = await updateMaintenance(ctx.orgId, id, updateData);
      await maybeResetOil(ctx.orgId, input.status, prev?.tipo, prev);
      return updated;
    }),
});

// Reset da troca de óleo SÓ na transição para "concluída" de uma manutenção de
// óleo (evita re-registrar se ela já estava concluída). Efeito na borda.
async function maybeResetOil(
  orgId: number,
  novoStatus: string | undefined,
  tipo: string | null | undefined,
  prev: { status: string; veiculoId: number } | undefined
) {
  if (
    novoStatus === "concluida" &&
    prev &&
    prev.status !== "concluida" &&
    isOilChange(tipo) &&
    prev.veiculoId
  ) {
    await resetOilChange(orgId, prev.veiculoId);
  }
}

export const dashboardRouter = router({
  // Resumo financeiro CONSOLIDADO (fonte única): viagens + manutenções +
  // lançamentos manuais. Usado pelo Financeiro e pelos Relatórios.
  financeSummary: activeOrgProcedure
    .input(z.object({ sinceDays: z.number().int().positive() }).optional())
    .query(async ({ ctx, input }) => {
      const [trips, maintenances, expenses, revenues, vehicles] =
        await Promise.all([
          getTrips(ctx.orgId),
          getMaintenances(ctx.orgId),
          getExpenses(ctx.orgId),
          getRevenues(ctx.orgId),
          getVehicles(ctx.orgId),
        ]);
      const src = { trips, maintenances, expenses, revenues };
      const sinceMs = input?.sinceDays
        ? Date.now() - input.sinceDays * 24 * 60 * 60 * 1000
        : null;
      const summary = computeFinanceSummary(src, sinceMs);
      const monthly = computeMonthlySeries(src, Date.now(), 6);
      const ledger = computeFinanceLedger(src, vehicles);
      return { ...summary, monthly, ledger };
    }),

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
      ...vehiclesList
        .map(v => ({ v, oil: computeOilStatus(v) }))
        .filter(x => x.oil.status !== "ok")
        .map(({ v, oil }) => ({
          type: "oleo",
          title:
            oil.status === "vencida"
              ? "Troca de óleo vencida"
              : "Troca de óleo próxima",
          message:
            oil.status === "vencida"
              ? `Veículo ${v.placa} passou ${-oil.kmRestante} km do ponto de troca de óleo.`
              : `Veículo ${v.placa}: faltam ${oil.kmRestante} km para a troca de óleo.`,
          urgency: oil.status === "vencida" ? "alta" : "media",
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
