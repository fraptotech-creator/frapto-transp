import { eq, and, gt, or, lte, sql } from "drizzle-orm";
import {
  organizations,
  users,
  vehicles,
  drivers,
  trips,
  stripeEvents,
  InsertOrganization,
} from "../../drizzle/schema";
import { getDb } from "./client";
import {
  isDupError,
  podeReivindicar,
  podeMarcar,
  deveAplicarEfeito,
} from "../_core/stripeEventState";

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

/**
 * Consome o token de reset ATOMICAMENTE. Numa ÚNICA query condicional: casa por
 * hash + não expirado e, se casar, grava a senha nova, LIMPA o token e
 * incrementa a sessionVersion (derruba sessões antigas). Retorna true só quando
 * exatamente 1 linha foi afetada.
 *
 * Antes era ler → checar → gravar → limpar → incrementar (4 passos): duas
 * requisições concorrentes com o MESMO token passavam as duas (reuso/corrida) e,
 * se um passo intermediário falhasse, o token continuava válido. Agora o banco
 * arbitra: só um vencedor, e o token some junto com a troca — tudo ou nada.
 */
export async function consumeResetToken(
  hash: string,
  passwordHash: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      resetTokenHash: null,
      resetTokenExpiraEm: null,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(
      and(
        eq(users.resetTokenHash, hash),
        gt(users.resetTokenExpiraEm, new Date())
      )
    );
  return (res[0] as { affectedRows?: number })?.affectedRows === 1;
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

// Idempotência do webhook Stripe: registra o event.id UMA vez. Retorna true se
// é NOVO (processar), false se já foi visto (retry → descartar sem reaplicar).
// Erro de chave duplicada = já processado; qualquer outro erro PROPAGA (não
// engole — o webhook devolve 400 e o Stripe reenvia).
export type StripeClaim =
  | { claim: "claimed"; generation: number }
  | { claim: "processed" }
  | { claim: "busy" };

// Reivindica o evento para processar, ATOMICAMENTE:
// - INSERT novo (status 'processing') → "claimed";
// - se já existe: 'processed' → "processed" (efeito já aplicado, no-op);
//   'failed' ou 'processing' STALE → UPDATE condicional reivindica → "claimed";
//   'processing' recente (outro worker) → "busy".
// A duplicata é detectada percorrendo a cadeia de cause (Drizzle embrulha).
export async function claimStripeEvent(
  id: string,
  eventType: string,
  staleMs: number,
  now: Date
): Promise<StripeClaim> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db
      .insert(stripeEvents)
      .values({ id, eventType, status: "processing", attempts: 1 });
    return { claim: "claimed", generation: 1 };
  } catch (e) {
    if (!isDupError(e)) throw e; // erro real propaga (não engole)
  }
  // Já existe: decide pela linha atual.
  const rows = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return { claim: "busy" }; // sumiu numa corrida → ocupado (retry)
  if (row.status === "processed") return { claim: "processed" };
  if (!podeReivindicar(row, now, staleMs)) return { claim: "busy" };
  // Reivindica condicional: só vence quem casar o estado esperado (failed OU
  // processing stale). A nova GERAÇÃO é attempts+1. Duas corridas: o row-lock
  // serializa; a 2ª reavalia o WHERE (updatedAt já fresco) e falha → busy.
  const novaGeracao = (row.attempts ?? 0) + 1;
  const staleCutoff = new Date(now.getTime() - staleMs);
  const res = await db
    .update(stripeEvents)
    .set({ status: "processing", attempts: novaGeracao, lastError: null })
    .where(
      and(
        eq(stripeEvents.id, id),
        or(
          eq(stripeEvents.status, "failed"),
          and(
            eq(stripeEvents.status, "processing"),
            lte(stripeEvents.updatedAt, staleCutoff)
          )
        )
      )
    );
  const afetadas = (res[0] as { affectedRows?: number })?.affectedRows ?? 0;
  return afetadas >= 1
    ? { claim: "claimed", generation: novaGeracao }
    : { claim: "busy" };
}

// FENCING: só fecha se ainda for 'processing' E da MESMA geração (attempts) da
// claim. affectedRows===1 = a transição foi nossa; 0 = lease perdido (outro
// worker reivindicou por stale) → NUNCA tratar como concluída. Retorna se marcou.
export async function markStripeEventProcessed(
  id: string,
  generation: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db
    .update(stripeEvents)
    .set({ status: "processed", lastError: null })
    .where(
      and(
        eq(stripeEvents.id, id),
        eq(stripeEvents.status, "processing"),
        eq(stripeEvents.attempts, generation)
      )
    );
  return ((res[0] as { affectedRows?: number })?.affectedRows ?? 0) === 1;
}

export async function markStripeEventFailed(
  id: string,
  generation: number,
  safeError: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db
    .update(stripeEvents)
    .set({ status: "failed", lastError: safeError.slice(0, 200) })
    .where(
      and(
        eq(stripeEvents.id, id),
        eq(stripeEvents.status, "processing"),
        eq(stripeEvents.attempts, generation)
      )
    );
  return ((res[0] as { affectedRows?: number })?.affectedRows ?? 0) === 1;
}

// Efeito aplicável à organização, já RESOLVIDO a partir da fonte da verdade do
// Stripe (re-consulta). Dados PUROS — nenhuma chamada de rede acontece dentro
// da transação de commit.
export interface OrgSubscriptionEffect {
  subscriptionStatus: NonNullable<InsertOrganization["subscriptionStatus"]>;
  stripeSubscriptionId: string;
  currentPeriodEnd: Date | null;
}

export interface CommitLeaseParams {
  eventId: string;
  generation: number;
  // orgId/effect nulos = nada a aplicar (tipo ignorado, checkout sem assinatura,
  // org não resolvível) — ainda assim o evento é marcado 'processed'.
  orgId: number | null;
  effect: OrgSubscriptionEffect | null;
  eventCreatedAt: Date;
}

export type CommitOutcome = "committed" | "lease-lost";

// Executor mínimo da transação de commit sob lease. Existe para tornar a
// ORQUESTRAÇÃO (checar posse → aplicar efeito → marcar) testável sem banco real
// (mesmo padrão de OrgOwnerExecutor). O wrapper real liga cada método ao `tx`.
export interface LeaseExecutor {
  // SELECT ... FOR UPDATE da linha do evento (row lock pessimista).
  lockEvent(
    id: string
  ): Promise<{ status: string; attempts: number | null } | undefined>;
  // SELECT ... FOR UPDATE da ORGANIZAÇÃO: trava a linha e devolve o estado atual
  // para a decisão de ordem ser atômica (serializa efeitos concorrentes da mesma
  // org). undefined se a org sumiu.
  lockOrgState(
    orgId: number
  ): Promise<
    { subscriptionStatus: string; lastStripeEventAt: Date | null } | undefined
  >;
  // UPDATE INCONDICIONAL da organização (a ordem já foi decidida sob o lock).
  applyOrgEffect(
    orgId: number,
    effect: OrgSubscriptionEffect,
    eventCreatedAt: Date
  ): Promise<void>;
  // Marca 'processed' com fencing pela geração; retorna linhas afetadas.
  markProcessed(id: string, generation: number): Promise<number>;
}

// Orquestração PURA do commit sob lease. Dentro de UMA transação:
//   1. trava a linha do evento (row lock);
//   2. se NÃO somos mais donos da geração (worker antigo perdeu o lease por
//      reclaim/stale), NÃO toca a organização → "lease-lost" (rollback);
//   3. trava a ORG, lê o estado atual e decide a ordem (deveAplicarEfeito:
//      determinística, fail-closed no empate de timestamp) — só então aplica o
//      efeito (UPDATE incondicional sob o lock); se a org sumiu ou o evento é
//      atrasado/perdedor do empate, PULA o efeito (mas ainda marca processed);
//   4. marca 'processed' na MESMA transação, com fencing pela geração;
//   5. se a marca não afeta exatamente 1 linha (inconsistência sob o lock),
//      LANÇA → rollback (desfaz também o efeito na organização).
// Assim o efeito de assinatura e a marca são ATÔMICOS sob a geração atual, e a
// ordem por org/assinatura é determinística mesmo com eventos no mesmo segundo.
export async function commitStripeEffectCore(
  exec: LeaseExecutor,
  params: CommitLeaseParams
): Promise<CommitOutcome> {
  const row = await exec.lockEvent(params.eventId);
  if (!row || !podeMarcar(row, params.generation)) return "lease-lost";
  if (params.orgId != null && params.effect) {
    const org = await exec.lockOrgState(params.orgId);
    if (
      org &&
      deveAplicarEfeito(
        { status: org.subscriptionStatus, at: org.lastStripeEventAt },
        { status: params.effect.subscriptionStatus, at: params.eventCreatedAt }
      )
    ) {
      await exec.applyOrgEffect(
        params.orgId,
        params.effect,
        params.eventCreatedAt
      );
    }
  }
  const afetadas = await exec.markProcessed(params.eventId, params.generation);
  if (afetadas !== 1) {
    throw new Error("fencing inconsistente ao concluir evento Stripe");
  }
  return "committed";
}

// Wrapper REAL: abre transação CURTA e liga o executor ao `tx`. O row lock vem
// de `.for("update")` — confirmado que o Drizzle instalado gera
// `... for update` (SELECT com lock pessimista; TiDB/MySQL serializam duas
// transações nesse lock). A chamada de rede ao Stripe fica FORA daqui (o efeito
// já chega resolvido) — nada de rede dentro da transação.
export async function commitStripeEffectUnderLease(
  params: CommitLeaseParams
): Promise<CommitOutcome> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const exec: LeaseExecutor = {
      async lockEvent(id) {
        const rows = await tx
          .select({
            status: stripeEvents.status,
            attempts: stripeEvents.attempts,
          })
          .from(stripeEvents)
          .where(eq(stripeEvents.id, id))
          .for("update")
          .limit(1);
        return rows[0];
      },
      async lockOrgState(orgId) {
        const rows = await tx
          .select({
            subscriptionStatus: organizations.subscriptionStatus,
            lastStripeEventAt: organizations.lastStripeEventAt,
          })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .for("update")
          .limit(1);
        return rows[0];
      },
      async applyOrgEffect(orgId, effect, eventCreatedAt) {
        // UPDATE incondicional: a ordem já foi decidida sob o lock da org.
        await tx
          .update(organizations)
          .set({ ...effect, lastStripeEventAt: eventCreatedAt })
          .where(eq(organizations.id, orgId));
      },
      async markProcessed(id, generation) {
        const res = await tx
          .update(stripeEvents)
          .set({ status: "processed", lastError: null })
          .where(
            and(
              eq(stripeEvents.id, id),
              eq(stripeEvents.status, "processing"),
              eq(stripeEvents.attempts, generation)
            )
          );
        return (res[0] as { affectedRows?: number })?.affectedRows ?? 0;
      },
    };
    return commitStripeEffectCore(exec, params);
  });
}
