import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { driverProcedure, router } from "../_core/trpc";
import { getTrips, getTripById, updateTrip, accrueTripKm } from "../db";
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
});
