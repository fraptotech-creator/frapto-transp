import { eq, desc } from "drizzle-orm";
import { Trip } from "../drizzle/schema";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import {
  InsertUser,
  users,
  vehicles,
  drivers,
  trips,
  notifications,
  maintenance,
  InsertVehicle,
  InsertDriver,
  InsertTrip,
  InsertNotification,
  InsertMaintenance,
  InsertExpense,
  InsertRevenue,
  aiConfig,
  InsertAiConfig,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof createPool> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const poolConfig = {
        // Pool de produção (TiDB aguenta centenas de conexões concorrentes).
        connectionLimit: 100,
        waitForConnections: true,
        queueLimit: 200,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000,
        // TiDB Serverless exige TLS. rejectUnauthorized (default true) valida
        // contra a CA pública embutida no Node (cert do gateway TiDB é público).
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (
      user.email &&
      ENV.ownerEmail &&
      user.email.toLowerCase() === ENV.ownerEmail.toLowerCase()
    ) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Queries para Veículos
export async function updateVehicle(id: number, data: Partial<InsertVehicle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vehicles).set(data).where(eq(vehicles.id, id));
  const result = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  return result[0];
}

export async function deleteVehicle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(vehicles).where(eq(vehicles.id, id));
  return { success: true };
}

export async function getVehicles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vehicles);
}

export async function getVehicleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);
  return result[0];
}

export async function createVehicle(data: InsertVehicle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(vehicles).values(data);
  // Retornar o veículo criado
  const result = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.placa, data.placa))
    .limit(1);
  return result[0];
}

// Queries para Motoristas
export async function updateDriver(id: number, data: Partial<InsertDriver>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(drivers).set(data).where(eq(drivers.id, id));
  const result = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, id))
    .limit(1);
  return result[0];
}

export async function deleteDriver(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(drivers).where(eq(drivers.id, id));
  return { success: true };
}

export async function getDrivers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers);
}

export async function getDriverById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, id))
    .limit(1);
  return result[0];
}

export async function createDriver(data: InsertDriver) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(drivers).values(data);
  // Retornar o motorista criado
  const result = await db
    .select()
    .from(drivers)
    .where(eq(drivers.cpf, data.cpf))
    .limit(1);
  return result[0];
}

// Queries para Viagens
export async function updateTrip(id: number, data: Partial<InsertTrip>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(trips).set(data).where(eq(trips.id, id));
  const result = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return result[0];
}

export async function deleteTrip(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(trips).where(eq(trips.id, id));
  return { success: true };
}

export async function getTrips() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trips);
}

export async function getTripById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return result[0];
}

export async function createTrip(data: InsertTrip) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(trips).values(data);
  // Retornar a viagem criada
  const result = await db
    .select()
    .from(trips)
    .where(eq(trips.numeroViagem, data.numeroViagem))
    .limit(1);
  return result[0];
}

// Queries para Notificações
export async function getNotifications(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.usuarioId, usuarioId));
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
  // Retornar a notificação criada
  const result = await db
    .select()
    .from(notifications)
    .where(eq(notifications.usuarioId, data.usuarioId))
    .orderBy(n => n.id)
    .limit(1);
  return result[0];
}

// Queries para Manutenção
export async function getMaintenances() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenance).orderBy(desc(maintenance.dataPrevista));
}

export async function getMaintenanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(maintenance)
    .where(eq(maintenance.id, id))
    .limit(1);
  return result[0];
}

export async function getMaintenancesByVehicle(veiculoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(maintenance)
    .where(eq(maintenance.veiculoId, veiculoId))
    .orderBy(desc(maintenance.dataPrevista));
}

export async function createMaintenance(data: InsertMaintenance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(maintenance).values(data);
  // Retornar a manutenção criada
  const inserted = await db
    .select()
    .from(maintenance)
    .where(eq(maintenance.veiculoId, data.veiculoId))
    .orderBy(desc(maintenance.id))
    .limit(1);
  return inserted[0];
}

export async function updateMaintenance(
  id: number,
  data: Partial<InsertMaintenance>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(maintenance).set(data).where(eq(maintenance.id, id));
  const result = await db
    .select()
    .from(maintenance)
    .where(eq(maintenance.id, id))
    .limit(1);
  return result[0];
}

// Queries para Despesas
export async function getExpenses() {
  const db = await getDb();
  if (!db) return [];
  const { expenses } = await import("../drizzle/schema");
  return db.select().from(expenses).orderBy(desc(expenses.data));
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { expenses } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  return result[0];
}

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.insert(expenses).values(data);
  const result = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.id))
    .limit(1);
  return result[0];
}

export async function updateExpense(id: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
  const result = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  return result[0];
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { expenses } = await import("../drizzle/schema");
  await db.delete(expenses).where(eq(expenses.id, id));
  return { success: true };
}

// Queries para Receitas
export async function getRevenues() {
  const db = await getDb();
  if (!db) return [];
  const { revenues } = await import("../drizzle/schema");
  return db.select().from(revenues).orderBy(desc(revenues.data));
}

export async function getRevenueById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { revenues } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(revenues)
    .where(eq(revenues.id, id))
    .limit(1);
  return result[0];
}

export async function createRevenue(data: InsertRevenue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { revenues } = await import("../drizzle/schema");
  await db.insert(revenues).values(data);
  const result = await db
    .select()
    .from(revenues)
    .orderBy(desc(revenues.id))
    .limit(1);
  return result[0];
}

export async function updateRevenue(id: number, data: Partial<InsertRevenue>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { revenues } = await import("../drizzle/schema");
  await db.update(revenues).set(data).where(eq(revenues.id, id));
  const result = await db
    .select()
    .from(revenues)
    .where(eq(revenues.id, id))
    .limit(1);
  return result[0];
}

export async function deleteRevenue(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { revenues } = await import("../drizzle/schema");
  await db.delete(revenues).where(eq(revenues.id, id));
  return { success: true };
}

// Configuração da IA (linha única, id=1).
export async function getAiConfig() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.id, 1))
    .limit(1);
  return result[0];
}

export async function upsertAiConfig(data: Partial<InsertAiConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(aiConfig)
    .values({ id: 1, ...data })
    .onDuplicateKeyUpdate({ set: data });
  return getAiConfig();
}
