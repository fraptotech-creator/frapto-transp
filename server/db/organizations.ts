import { eq, and, desc, sql } from "drizzle-orm";
import { organizations, users, InsertOrganization } from "../../drizzle/schema";
import { getDb } from "./client";

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

// ─── Login de motorista ──────────────────────────────────────────────────────

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0];
}

// Cria o USUÁRIO de login vinculado a um motorista (papel "driver").
export async function createDriverUser(params: {
  orgId: number;
  driverId: number;
  openId: string;
  username: string;
  passwordHash: string;
  name: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    openId: params.openId,
    orgId: params.orgId,
    driverId: params.driverId,
    username: params.username,
    passwordHash: params.passwordHash,
    name: params.name,
    loginMethod: "password",
    orgRole: "driver",
    mustChangePassword: true,
    lastSignedIn: new Date(),
  });
}

// Acha o login de um motorista DENTRO da org (para reset pelo admin).
export async function getDriverUser(orgId: number, driverId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.driverId, driverId)))
    .limit(1);
  return result[0];
}

// Atualiza o usuário (apelido de login) de um login existente.
export async function setUsername(openId: string, username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ username }).where(eq(users.openId, openId));
}

// Define a senha de um usuário (troca no 1º acesso / reset). mustChange controla
// se ele será obrigado a trocar no próximo login.
export async function setUserPassword(
  openId: string,
  passwordHash: string,
  mustChange: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: mustChange })
    .where(eq(users.openId, openId));
}

// Apaga o login vinculado a um motorista (ao excluir o motorista).
export async function deleteDriverUser(orgId: number, driverId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(users)
    .where(and(eq(users.orgId, orgId), eq(users.driverId, driverId)));
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
