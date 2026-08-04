import { eq, and } from "drizzle-orm";
import { stripeCheckoutIntents } from "../../drizzle/schema";
import { getDb } from "./client";
import { isDupError } from "../_core/stripeEventState";

// Coordenação DURÁVEL de checkout (exatamente-uma-vez entre réplicas), sem mutex
// em memória: a unicidade por orgId (PK) + uma idempotency key ESTÁVEL enviada ao
// Stripe garantem no máximo um customer/sessão por org, mesmo com N réplicas.

export interface CheckoutIntentRow {
  idempotencyKey: string;
  sessionUrl: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type CheckoutClaim =
  | { action: "reuse"; key: string; url: string | null }
  | { action: "create"; key: string };

// Decisão PURA de reuso × recriação (testável sem banco). O invariante crítico:
// NUNCA trocar de idempotency key só porque a URL local está nula (crash antes do
// finalize) — re-chamar o Stripe com a MESMA chave RECUPERA a sessão original
// (idempotência), sem abrir uma segunda. Só cria chave nova quando há PROVA de
// expiração (uma url que existiu e passou da validade — a sessão antiga não é
// mais pagável):
//   - sem linha → cria (chave nova);
//   - url válida (não expirada) → reutiliza a MESMA url (nenhuma nova sessão);
//   - url EXPIRADA (prova) → cria (chave nova; a antiga expirou, não é pagável);
//   - sem url (em progresso / crash antes do finalize, qualquer idade) →
//     REUTILIZA a chave (recuperação autoritativa via Stripe), nunca cria K2.
export function decideCheckoutIntent(
  existing: CheckoutIntentRow | undefined,
  now: Date,
  newKey: string
): CheckoutClaim {
  if (!existing) return { action: "create", key: newKey };
  const t = now.getTime();
  if (existing.sessionUrl && existing.expiresAt) {
    return existing.expiresAt.getTime() > t
      ? {
          action: "reuse",
          key: existing.idempotencyKey,
          url: existing.sessionUrl,
        }
      : { action: "create", key: newKey }; // expiração COMPROVADA → K2 seguro
  }
  // sem url (ou sem expiresAt conhecido): recupera a MESMA chave — nada de K2.
  return {
    action: "reuse",
    key: existing.idempotencyKey,
    url: existing.sessionUrl ?? null,
  };
}

// Executor mínimo (injetável p/ teste sem banco). insertNew devolve false quando
// já existe (dup key); recreate é um UPDATE condicional (CAS na chave atual).
export interface CheckoutIntentExecutor {
  insertNew(orgId: number, key: string, now: Date): Promise<boolean>;
  read(orgId: number): Promise<CheckoutIntentRow | undefined>;
  recreate(
    orgId: number,
    expectedKey: string,
    newKey: string,
    now: Date
  ): Promise<number>;
}

// Orquestração PURA: converge para UMA chave por org sob concorrência.
//   1) INSERT (ganha a corrida → chave nova);
//   2) se já existe: decide reuse × recreate; recreate é CAS (WHERE chave atual)
//      — se outra réplica recriou antes (affected 0), re-lê e reusa a chave dela.
export async function claimCheckoutIntentCore(
  exec: CheckoutIntentExecutor,
  params: { orgId: number; newKey: string; now: Date },
  maxTries = 3
): Promise<{ key: string; url: string | null }> {
  const { orgId, newKey, now } = params;
  if (await exec.insertNew(orgId, newKey, now))
    return { key: newKey, url: null };
  for (let i = 0; i < maxTries; i++) {
    const row = await exec.read(orgId);
    if (!row) {
      if (await exec.insertNew(orgId, newKey, now)) {
        return { key: newKey, url: null };
      }
      continue;
    }
    const dec = decideCheckoutIntent(row, now, newKey);
    if (dec.action === "reuse") return { key: dec.key, url: dec.url };
    const afetadas = await exec.recreate(
      orgId,
      row.idempotencyKey,
      newKey,
      now
    );
    if (afetadas === 1) return { key: newKey, url: null };
    // affected 0 → outra réplica venceu o recreate; volta e reusa a chave nova.
  }
  const row = await exec.read(orgId);
  return { key: row?.idempotencyKey ?? newKey, url: row?.sessionUrl ?? null };
}

function realExecutor(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): CheckoutIntentExecutor {
  return {
    async insertNew(orgId, key, now) {
      try {
        await db
          .insert(stripeCheckoutIntents)
          .values({ orgId, idempotencyKey: key, createdAt: now });
        return true;
      } catch (e) {
        if (isDupError(e)) return false;
        throw e;
      }
    },
    async read(orgId) {
      const rows = await db
        .select()
        .from(stripeCheckoutIntents)
        .where(eq(stripeCheckoutIntents.orgId, orgId))
        .limit(1);
      const r = rows[0];
      return r
        ? {
            idempotencyKey: r.idempotencyKey,
            sessionUrl: r.sessionUrl,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
          }
        : undefined;
    },
    async recreate(orgId, expectedKey, newKey, now) {
      const res = await db
        .update(stripeCheckoutIntents)
        .set({
          idempotencyKey: newKey,
          sessionUrl: null,
          expiresAt: null,
          createdAt: now,
        })
        .where(
          and(
            eq(stripeCheckoutIntents.orgId, orgId),
            eq(stripeCheckoutIntents.idempotencyKey, expectedKey)
          )
        );
      return (res[0] as { affectedRows?: number })?.affectedRows ?? 0;
    },
  };
}

// Reivindica (durável) a intenção de checkout da org: devolve a idempotency key
// ESTÁVEL a usar no Stripe e, se já houver, a url de uma sessão ainda válida.
export async function claimCheckoutIntent(
  orgId: number,
  newKey: string,
  now: Date
): Promise<{ key: string; url: string | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return claimCheckoutIntentCore(realExecutor(db), { orgId, newKey, now });
}

// Grava a url/expiração da sessão criada — CAS: só se a chave ainda for a nossa
// (não sobrescreve uma tentativa nova que já tenha recriado a intenção).
export async function finalizeCheckoutIntent(
  orgId: number,
  key: string,
  url: string,
  expiresAt: Date | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(stripeCheckoutIntents)
    .set({ sessionUrl: url, expiresAt })
    .where(
      and(
        eq(stripeCheckoutIntents.orgId, orgId),
        eq(stripeCheckoutIntents.idempotencyKey, key)
      )
    );
}
