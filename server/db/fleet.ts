import { eq, and, desc, sql } from "drizzle-orm";
import { tripKmToAccrue } from "../_core/odometer";
import {
  vehicles,
  drivers,
  trips,
  maintenance,
  tripPositions,
  InsertVehicle,
  InsertDriver,
  InsertTrip,
  InsertMaintenance,
  InsertTripPosition,
} from "../../drizzle/schema";
import { getDb } from "./client";

// ─── Veículos ────────────────────────────────────────────────────────────────

export async function getVehicles(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles).where(eq(vehicles.orgId, orgId));
}

export async function getVehicleById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)))
    .limit(1);
  return result[0];
}

export async function createVehicle(
  orgId: number,
  data: Omit<InsertVehicle, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(vehicles).values({ ...data, orgId });
  const result = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.placa, data.placa)))
    .limit(1);
  return result[0];
}

export async function updateVehicle(
  orgId: number,
  id: number,
  data: Partial<InsertVehicle>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(vehicles)
    .set(data)
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)));
  return getVehicleById(orgId, id);
}

export async function deleteVehicle(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(vehicles)
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, id)));
  return { success: true };
}

// ─── Motoristas ──────────────────────────────────────────────────────────────

export async function getDrivers(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).where(eq(drivers.orgId, orgId));
}

export async function getDriverById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.orgId, orgId), eq(drivers.id, id)))
    .limit(1);
  return result[0];
}

export async function createDriver(
  orgId: number,
  data: Omit<InsertDriver, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(drivers).values({ ...data, orgId });
  const result = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.orgId, orgId), eq(drivers.cpf, data.cpf)))
    .limit(1);
  return result[0];
}

export async function updateDriver(
  orgId: number,
  id: number,
  data: Partial<InsertDriver>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(drivers)
    .set(data)
    .where(and(eq(drivers.orgId, orgId), eq(drivers.id, id)));
  return getDriverById(orgId, id);
}

export async function deleteDriver(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(drivers)
    .where(and(eq(drivers.orgId, orgId), eq(drivers.id, id)));
  return { success: true };
}

// ─── Viagens ─────────────────────────────────────────────────────────────────

export async function getTrips(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trips).where(eq(trips.orgId, orgId));
}

export async function getTripById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(trips)
    .where(and(eq(trips.orgId, orgId), eq(trips.id, id)))
    .limit(1);
  return result[0];
}

export async function createTrip(
  orgId: number,
  data: Omit<InsertTrip, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(trips).values({ ...data, orgId });
  const result = await db
    .select()
    .from(trips)
    .where(
      and(eq(trips.orgId, orgId), eq(trips.numeroViagem, data.numeroViagem))
    )
    .limit(1);
  return result[0];
}

export async function updateTrip(
  orgId: number,
  id: number,
  data: Partial<InsertTrip>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(trips)
    .set(data)
    .where(and(eq(trips.orgId, orgId), eq(trips.id, id)));
  return getTripById(orgId, id);
}

export async function deleteTrip(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(trips).where(and(eq(trips.orgId, orgId), eq(trips.id, id)));
  return { success: true };
}

// Ao concluir uma viagem, soma a distância ao odômetro do veículo — UMA vez só
// (a flag quilometragemAplicada garante idempotência). Decisão pura decide o
// quanto; aqui só aplicamos o efeito, dentro do escopo da org.
export async function accrueTripKm(orgId: number, tripId: number) {
  const db = await getDb();
  if (!db) return;
  const trip = await getTripById(orgId, tripId);
  if (!trip) return;
  const km = tripKmToAccrue(trip);
  if (km <= 0) return;
  await db
    .update(vehicles)
    .set({ quilometragem: sql`${vehicles.quilometragem} + ${km}` })
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, trip.veiculoId)));
  await db
    .update(trips)
    .set({ quilometragemAplicada: true })
    .where(and(eq(trips.orgId, orgId), eq(trips.id, tripId)));
}

// Registra que a troca de óleo foi feita AGORA: grava o odômetro atual do
// veículo como "última troca". A próxima passa a contar a partir daqui.
export async function resetOilChange(orgId: number, vehicleId: number) {
  const db = await getDb();
  if (!db) return;
  const v = await getVehicleById(orgId, vehicleId);
  if (!v) return;
  await db
    .update(vehicles)
    .set({ kmUltimaTrocaOleo: v.quilometragem ?? 0 })
    .where(and(eq(vehicles.orgId, orgId), eq(vehicles.id, vehicleId)));
}

// ─── Rastreio (posições GPS da viagem) ───────────────────────────────────────

export async function addTripPosition(
  orgId: number,
  data: Omit<InsertTripPosition, "orgId">
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(tripPositions).values({ ...data, orgId });
}

export async function getTripPositions(orgId: number, tripId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tripPositions)
    .where(
      and(eq(tripPositions.orgId, orgId), eq(tripPositions.tripId, tripId))
    )
    .orderBy(tripPositions.capturedAt);
}

// ─── Manutenção ──────────────────────────────────────────────────────────────

export async function getMaintenances(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(maintenance)
    .where(eq(maintenance.orgId, orgId))
    .orderBy(desc(maintenance.dataPrevista));
}

export async function getMaintenanceById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(maintenance)
    .where(and(eq(maintenance.orgId, orgId), eq(maintenance.id, id)))
    .limit(1);
  return result[0];
}

export async function getMaintenancesByVehicle(
  orgId: number,
  veiculoId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(maintenance)
    .where(
      and(eq(maintenance.orgId, orgId), eq(maintenance.veiculoId, veiculoId))
    )
    .orderBy(desc(maintenance.dataPrevista));
}

export async function createMaintenance(
  orgId: number,
  data: Omit<InsertMaintenance, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(maintenance).values({ ...data, orgId });
  const inserted = await db
    .select()
    .from(maintenance)
    .where(
      and(
        eq(maintenance.orgId, orgId),
        eq(maintenance.veiculoId, data.veiculoId)
      )
    )
    .orderBy(desc(maintenance.id))
    .limit(1);
  return inserted[0];
}

export async function updateMaintenance(
  orgId: number,
  id: number,
  data: Partial<InsertMaintenance>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(maintenance)
    .set(data)
    .where(and(eq(maintenance.orgId, orgId), eq(maintenance.id, id)));
  return getMaintenanceById(orgId, id);
}
