import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import {
  organizations,
  users,
  vehicles,
  drivers,
  trips,
  notifications,
  maintenance,
  expenses,
  revenues,
  documents,
  aiConfig,
  InsertUser,
  InsertOrganization,
  InsertVehicle,
  InsertDriver,
  InsertTrip,
  InsertNotification,
  InsertMaintenance,
  InsertExpense,
  InsertRevenue,
  InsertDocument,
  InsertAiConfig,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof createPool> | null = null;

// Cria o pool/drizzle sob demanda (local sem DB roda sem conectar).
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const poolConfig = {
        connectionLimit: 100,
        waitForConnections: true,
        queueLimit: 200,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000,
        // TiDB Serverless exige TLS.
        ssl: { minVersion: "TLSv1.2" as const },
      };
      _pool = createPool({ ...poolConfig, uri: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Organizações e usuários (auth) ─────────────────────────────────────────

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/**
 * Cadastro: cria a organização e o usuário DONO dela, numa tacada.
 * Retorna o usuário criado (com orgId).
 */
export async function createOrgAndOwner(params: {
  orgName: string;
  openId: string;
  email: string;
  passwordHash: string;
  name: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(organizations).values({ name: params.orgName });
  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.id))
    .limit(1);

  await db.insert(users).values({
    openId: params.openId,
    orgId: org.id,
    email: params.email,
    passwordHash: params.passwordHash,
    name: params.name,
    loginMethod: "password",
    orgRole: "owner",
    lastSignedIn: new Date(),
  });

  return getUserByOpenId(params.openId);
}

// Atualiza campos simples do usuário (ex.: lastSignedIn) por openId.
export async function touchUserLastSignedIn(openId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.openId, openId));
}

// Revogação de sessão: incrementa sessionVersion (mata os tokens antigos).
export async function incrementSessionVersion(openId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.openId, openId));
}

export async function getOrganization(orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return result[0];
}

export async function getOrgByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);
  return result[0];
}

export async function updateOrganization(
  orgId: number,
  data: Partial<InsertOrganization>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizations).set(data).where(eq(organizations.id, orgId));
  return getOrganization(orgId);
}

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

// ─── Notificações ────────────────────────────────────────────────────────────

export async function getNotifications(orgId: number, usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.orgId, orgId),
        eq(notifications.usuarioId, usuarioId)
      )
    );
}

export async function createNotification(
  orgId: number,
  data: Omit<InsertNotification, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values({ ...data, orgId });
  const result = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.orgId, orgId),
        eq(notifications.usuarioId, data.usuarioId)
      )
    )
    .orderBy(desc(notifications.id))
    .limit(1);
  return result[0];
}

// ─── Despesas ────────────────────────────────────────────────────────────────

export async function getExpenses(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.orgId, orgId))
    .orderBy(desc(expenses.data));
}

export async function getExpenseById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)))
    .limit(1);
  return result[0];
}

export async function createExpense(
  orgId: number,
  data: Omit<InsertExpense, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(expenses).values({ ...data, orgId });
  const result = await db
    .select()
    .from(expenses)
    .where(eq(expenses.orgId, orgId))
    .orderBy(desc(expenses.id))
    .limit(1);
  return result[0];
}

export async function updateExpense(
  orgId: number,
  id: number,
  data: Partial<InsertExpense>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(expenses)
    .set(data)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
  return getExpenseById(orgId, id);
}

export async function deleteExpense(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
  return { success: true };
}

// ─── Receitas ────────────────────────────────────────────────────────────────

export async function getRevenues(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(revenues)
    .where(eq(revenues.orgId, orgId))
    .orderBy(desc(revenues.data));
}

export async function getRevenueById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(revenues)
    .where(and(eq(revenues.orgId, orgId), eq(revenues.id, id)))
    .limit(1);
  return result[0];
}

export async function createRevenue(
  orgId: number,
  data: Omit<InsertRevenue, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(revenues).values({ ...data, orgId });
  const result = await db
    .select()
    .from(revenues)
    .where(eq(revenues.orgId, orgId))
    .orderBy(desc(revenues.id))
    .limit(1);
  return result[0];
}

export async function updateRevenue(
  orgId: number,
  id: number,
  data: Partial<InsertRevenue>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(revenues)
    .set(data)
    .where(and(eq(revenues.orgId, orgId), eq(revenues.id, id)));
  return getRevenueById(orgId, id);
}

export async function deleteRevenue(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(revenues)
    .where(and(eq(revenues.orgId, orgId), eq(revenues.id, id)));
  return { success: true };
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export async function getDocuments(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.id));
}

export async function getDocumentById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
    .limit(1);
  return result[0];
}

export async function createDocument(
  orgId: number,
  data: Omit<InsertDocument, "orgId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documents).values({ ...data, orgId });
  const result = await db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.id))
    .limit(1);
  return result[0];
}

export async function deleteDocument(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, id)));
  return { success: true };
}

// ─── Config de IA (por organização) ──────────────────────────────────────────

export async function getAiConfig(orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.orgId, orgId))
    .limit(1);
  return result[0];
}

export async function upsertAiConfig(
  orgId: number,
  data: Partial<Omit<InsertAiConfig, "orgId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(aiConfig)
    .values({ orgId, ...data })
    .onDuplicateKeyUpdate({ set: data });
  return getAiConfig(orgId);
}
