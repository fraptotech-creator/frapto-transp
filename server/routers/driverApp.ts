import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { driverProcedure, router } from "../_core/trpc";
import {
  getTrips,
  getTripById,
  updateTrip,
  accrueTripKm,
  addTripPosition,
} from "../db";
import { canRecordPosition } from "../_core/tracking";
import type { Trip } from "../../drizzle/schema";

// Remove o valor/frete ANTES de enviar ao motorista (ele nunca vê o valor).
function stripValor(t: Trip): Omit<Trip, "valor"> {
  const { valor: _omit, ...rest } = t;
  return rest;
}

// Área do MOTORISTA. Todos os endpoints são escopados ao motorista logado
// (ctx.driverId) e à org dele — ele só enxerga/afeta as viagens vinculadas.
export const driverAppRouter = router({
  // Só as viagens DELE, sem o valor.
  myTrips: driverProcedure.query(async ({ ctx }) => {
    const trips = await getTrips(ctx.orgId);
    return trips.filter(t => t.motoristaId === ctx.driverId).map(stripValor);
  }),

  tripDetail: driverProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const trip = await getTripById(ctx.orgId, input.id);
      if (!trip || trip.motoristaId !== ctx.driverId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Viagem não encontrada.",
        });
      }
      return stripValor(trip);
    }),

  startTrip: driverProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await getTripById(ctx.orgId, input.id);
      if (!trip || trip.motoristaId !== ctx.driverId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Viagem não encontrada.",
        });
      }
      await updateTrip(ctx.orgId, input.id, { status: "em_andamento" });
      return { success: true } as const;
    }),

  // Conclui a viagem informando a data/hora REAL de chegada no cliente.
  completeTrip: driverProcedure
    .input(z.object({ id: z.number(), dataChegada: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await getTripById(ctx.orgId, input.id);
      if (!trip || trip.motoristaId !== ctx.driverId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Viagem não encontrada.",
        });
      }
      await updateTrip(ctx.orgId, input.id, {
        status: "concluida",
        dataChegada: input.dataChegada,
      });
      // Concluiu → soma a distância ao odômetro do veículo (idempotente).
      await accrueTripKm(ctx.orgId, input.id);
      return { success: true } as const;
    }),

  // Rastreio: o celular do motorista envia a posição GPS enquanto a viagem
  // está EM ANDAMENTO. Só grava se a viagem for dele e estiver em curso —
  // qualquer outra situação é ignorada em silêncio (não é erro do app).
  reportPosition: driverProcedure
    .input(
      z.object({
        tripId: z.number(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        velocidade: z.number().min(0).max(400).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trip = await getTripById(ctx.orgId, input.tripId);
      if (!trip || !canRecordPosition(trip, ctx.driverId)) {
        return { recorded: false } as const;
      }
      await addTripPosition(ctx.orgId, {
        tripId: trip.id,
        veiculoId: trip.veiculoId,
        lat: String(input.lat),
        lng: String(input.lng),
        velocidade: input.velocidade != null ? String(input.velocidade) : null,
      });
      return { recorded: true } as const;
    }),
});
