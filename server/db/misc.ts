import { eq, and, desc } from "drizzle-orm";
import {
  documents,
  aiConfig,
  InsertDocument,
  InsertAiConfig,
} from "../../drizzle/schema";
import { getDb } from "./client";

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
  // Lê pelo ID deste insert (não "último doc da org", que sob concorrência
  // devolvia o documento de outro upload simultâneo). Sem chave natural única.
  const [ins] = await db
    .insert(documents)
    .values({ ...data, orgId })
    .$returningId();
  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, ins.id)))
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
