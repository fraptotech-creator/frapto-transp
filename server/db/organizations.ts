import { eq, and, sql } from "drizzle-orm";
import {
  organizations,
  users,
  vehicles,
  drivers,
  trips,
  InsertOrganization,
} from "../../drizzle/schema";
import { getDb } from "./client";

// ⚠️ ÚNICA leitura CROSS-ORG do sistema: painel do SUPER-ADMIN da plataforma.
// Não recebe orgId de propósito — quem protege é o superAdminProcedure
// (fail-closed por openId+email da env). NÃO use em nenhum outro lugar.
export async function listOrgsWithStatsForSuperAdmin() {
  const db = await getDb();
  if (!db) return [];
  const orgs = await db.select().from(organizations).orderBy(organizations.id);
  const [donos, uCount, vCount, dCount, tCount] = await Promise.all([
    // Email do DONO de cada empresa — é por ele que o super-admin identifica
    // quem é o cliente (e para quem cobrar por fora do Stripe).
    db
      .select({ orgId: users.orgId, email: users.email })
      .from(users)
      .where(eq(users.orgRole, "owner")),
    db
      .select({ orgId: users.orgId, n: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.orgId),
    db
      .select({ orgId: vehicles.orgId, n: sql<number>`count(*)` })
      .from(vehicles)
      .groupBy(vehicles.orgId),
    db
      .select({ orgId: drivers.orgId, n: sql<number>`count(*)` })
      .from(drivers)
      .groupBy(drivers.orgId),
    db
      .select({ orgId: trips.orgId, n: sql<number>`count(*)` })
      .from(trips)
      .groupBy(trips.orgId),
  ]);
  const pick = (
    rows: { orgId: number | null; n: number }[],
    orgId: number
  ): number => Number(rows.find(r => r.orgId === orgId)?.n ?? 0);
  return orgs.map(o => ({
    id: o.id,
    name: o.name,
    email: donos.find(d => d.orgId === o.id)?.email ?? null,
    subscriptionStatus: o.subscriptionStatus,
    planName: o.planName,
    trialEndsAt: o.trialEndsAt,
    currentPeriodEnd: o.currentPeriodEnd,
    createdAt: o.createdAt,
    usuarios: pick(uCount, o.id),
    veiculos: pick(vCount, o.id),
    motoristas: pick(dCount, o.id),
    viagens: pick(tCount, o.id),
  }));
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

/**
 * Cadastro: cria a organização e o usuário DONO dela, numa tacada.
 * Retorna o usuário criado (com orgId).
 */
export interface CreateOrgAndOwnerParams {
  orgName: string;
  openId: string;
  email: string;
  passwordHash: string;
  name: string | null;
}

// Executor mínimo que a orquestração precisa. Existe para tornar a lógica
// testável sem banco real (ver server/createOrgAndOwner.test.ts) e para deixar
// explícito o contrato: o ID do dono SAI do insert da org, nunca de um
// "último registro".
export interface OrgOwnerExecutor {
  insertOrg(name: string): Promise<number>;
  insertOwner(orgId: number, params: CreateOrgAndOwnerParams): Promise<void>;
}

/**
 * Orquestração PURA do cadastro. Usa o ID retornado pelo insert da org — o bug
 * antigo lia `ORDER BY id DESC LIMIT 1`, o que sob concorrência ligava o dono à
 * organização de OUTRO cadastro simultâneo (vazamento cross-tenant). Aqui cada
 * dono só pode receber o ID que o próprio insert devolveu.
 */
export async function createOrgAndOwnerCore(
  exec: OrgOwnerExecutor,
  params: CreateOrgAndOwnerParams
): Promise<number> {
  const orgId = await exec.insertOrg(params.orgName);
  // Se este passo falhar, a transação que envolve o executor real faz rollback
  // do insert da org — nada de empresa órfã.
  await exec.insertOwner(orgId, params);
  return orgId;
}

export async function createOrgAndOwner(params: CreateOrgAndOwnerParams) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Transação: org + dono nascem juntos ou nenhum dos dois. Falha na criação
  // do usuário (ex.: corrida de e-mail duplicado) desfaz a organização.
  await db.transaction(async tx => {
    await createOrgAndOwnerCore(
      {
        async insertOrg(name) {
          const [row] = await tx
            .insert(organizations)
            .values({ name })
            .$returningId();
          return row.id;
        },
        async insertOwner(orgId, p) {
          await tx.insert(users).values({
            openId: p.openId,
            orgId,
            email: p.email,
            passwordHash: p.passwordHash,
            name: p.name,
            loginMethod: "password",
            orgRole: "owner",
            lastSignedIn: new Date(),
          });
        },
      },
      params
    );
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

// ─── Recuperação de senha ────────────────────────────────────────────────────

export async function setResetToken(
  openId: string,
  hash: string | null,
  expiraEm: Date | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ resetTokenHash: hash, resetTokenExpiraEm: expiraEm })
    .where(eq(users.openId, openId));
}

// Busca pelo HASH do token — o valor cru nunca é gravado nem consultado.
export async function getUserByResetTokenHash(hash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.resetTokenHash, hash))
    .limit(1);
  return result[0];
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
