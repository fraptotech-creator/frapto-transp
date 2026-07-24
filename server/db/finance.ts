import { eq, and, desc } from "drizzle-orm";
import {
  expenses,
  revenues,
  InsertExpense,
  InsertRevenue,
} from "../../drizzle/schema";
import { getDb } from "./client";

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
  // Lê pelo ID que ESTE insert devolveu — não por "último id da org", que sob
  // concorrência devolvia a linha de outro create simultâneo (mesmo #1 da org).
  const [ins] = await db
    .insert(expenses)
    .values({ ...data, orgId })
    .$returningId();
  const result = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.id, ins.id)))
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
  const [ins] = await db
    .insert(revenues)
    .values({ ...data, orgId })
    .$returningId();
  const result = await db
    .select()
    .from(revenues)
    .where(and(eq(revenues.orgId, orgId), eq(revenues.id, ins.id)))
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
