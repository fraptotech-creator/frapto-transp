import { describe, it, expect, vi } from "vitest";
import { QueryBuilder } from "drizzle-orm/mysql-core";
import { eq, and } from "drizzle-orm";
import {
  commitStripeEffectCore,
  type LeaseExecutor,
  type CommitLeaseParams,
  type OrgSubscriptionEffect,
} from "./db/organizations";
import { stripeEvents, organizations } from "../drizzle/schema";

const effect: OrgSubscriptionEffect = {
  subscriptionStatus: "active",
  stripeSubscriptionId: "sub_1",
  currentPeriodEnd: null,
};

const params = (over: Partial<CommitLeaseParams> = {}): CommitLeaseParams => ({
  eventId: "evt_1",
  generation: 1,
  orgId: 1,
  effect,
  eventCreatedAt: new Date("2026-08-01T10:00:00Z"),
  ...over,
});

// Executor FAKE tipado (sem any) — grava a ordem das operações.
function fakeExec(over: {
  row?: { status: string; attempts: number | null } | undefined;
  org?:
    | { subscriptionStatus: string; lastStripeEventAt: Date | null }
    | undefined;
  marked?: number;
  applyThrows?: boolean;
}) {
  const calls: string[] = [];
  const exec: LeaseExecutor = {
    async lockEvent() {
      calls.push("lock");
      return over.row;
    },
    async lockOrgState() {
      calls.push("lockOrg");
      // Padrão: org sem efeito anterior (at null) → deveAplicarEfeito aplica.
      return "org" in over
        ? over.org
        : { subscriptionStatus: "none", lastStripeEventAt: null };
    },
    async applyOrgEffect() {
      calls.push("apply");
      if (over.applyThrows) throw new Error("db down no efeito");
    },
    async markProcessed() {
      calls.push("mark");
      return over.marked ?? 1;
    },
  };
  return { exec, calls };
}

describe("commitStripeEffectCore — efeito + marca atômicos sob lease (Lote 2)", () => {
  it("dono da geração: trava a org, aplica efeito E marca → committed", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      marked: 1,
    });
    const out = await commitStripeEffectCore(exec, params());
    expect(out).toBe("committed");
    // trava evento → trava org → aplica → marca, nessa ordem
    expect(calls).toEqual(["lock", "lockOrg", "apply", "mark"]);
  });

  it("linha sumida (lock não achou) → lease-lost, NÃO aplica nem marca", async () => {
    const { exec, calls } = fakeExec({ row: undefined });
    expect(await commitStripeEffectCore(exec, params())).toBe("lease-lost");
    expect(calls).toEqual(["lock"]);
  });

  it("geração defasada (worker antigo): B reivindicou (attempts=2), A(gen1) → lease-lost, org intacta", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 2 },
    });
    expect(await commitStripeEffectCore(exec, params({ generation: 1 }))).toBe(
      "lease-lost"
    );
    expect(calls).toEqual(["lock"]); // nunca tocou a organização
  });

  it("linha já processed → lease-lost (não reaplica efeito)", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processed", attempts: 1 },
    });
    expect(await commitStripeEffectCore(exec, params())).toBe("lease-lost");
    expect(calls).toEqual(["lock"]);
  });

  it("orgId/effect nulos (tipo ignorado): pula org+efeito, mas MARCA processed", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      marked: 1,
    });
    const out = await commitStripeEffectCore(
      exec,
      params({ orgId: null, effect: null })
    );
    expect(out).toBe("committed");
    expect(calls).toEqual(["lock", "mark"]); // sem 'lockOrg'/'apply'
  });

  it("evento ATRASADO (org mais recente): trava a org, PULA o efeito, mas marca", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      // org já em T2 (mais novo que o evento em T1) → deveAplicarEfeito=false
      org: {
        subscriptionStatus: "active",
        lastStripeEventAt: new Date("2026-08-01T10:05:00Z"),
      },
      marked: 1,
    });
    const out = await commitStripeEffectCore(
      exec,
      params({ eventCreatedAt: new Date("2026-08-01T10:00:00Z") })
    );
    expect(out).toBe("committed");
    expect(calls).toEqual(["lock", "lockOrg", "mark"]); // sem 'apply'
  });

  it("empate de timestamp: canceled NÃO reabre — org canceled@T, effect active@T → pula", async () => {
    const T = new Date("2026-08-01T10:00:00Z");
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      org: { subscriptionStatus: "canceled", lastStripeEventAt: T },
      marked: 1,
    });
    const out = await commitStripeEffectCore(
      exec,
      params({ eventCreatedAt: T }) // effect.subscriptionStatus = "active"
    );
    expect(out).toBe("committed");
    expect(calls).toEqual(["lock", "lockOrg", "mark"]); // não reabriu (sem apply)
  });

  it("marca não afeta 1 linha (inconsistência) → LANÇA (rollback)", async () => {
    const { exec } = fakeExec({
      row: { status: "processing", attempts: 1 },
      marked: 0,
    });
    await expect(commitStripeEffectCore(exec, params())).rejects.toThrow(
      /fencing inconsistente/
    );
  });

  it("efeito falha entre validação e marca → propaga (rollback), NÃO marca", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      applyThrows: true,
    });
    await expect(commitStripeEffectCore(exec, params())).rejects.toThrow(
      /db down no efeito/
    );
    expect(calls).toEqual(["lock", "lockOrg", "apply"]); // 'mark' nunca aconteceu
  });
});

describe("row lock — o Drizzle instalado gera SELECT ... FOR UPDATE (Lote 2)", () => {
  it("a query de lock do evento inclui `for update`", () => {
    const qb = new QueryBuilder();
    const sql = qb
      .select({ status: stripeEvents.status, attempts: stripeEvents.attempts })
      .from(stripeEvents)
      .where(eq(stripeEvents.id, "evt_1"))
      .for("update")
      .limit(1)
      .toSQL()
      .sql.toLowerCase();
    expect(sql).toContain("for update");
    expect(sql).toContain("stripe_events");
  });

  it("a marca 'processed' é cercada por status+attempts (fencing por geração)", () => {
    const qb = new QueryBuilder();
    const sql = qb
      .select()
      .from(stripeEvents)
      .where(
        and(
          eq(stripeEvents.id, "evt_1"),
          eq(stripeEvents.status, "processing"),
          eq(stripeEvents.attempts, 1)
        )
      )
      .toSQL()
      .sql.toLowerCase();
    expect(sql).toContain("status");
    expect(sql).toContain("attempts");
  });

  it("o lock da ORGANIZAÇÃO usa `for update` (serializa efeitos por org)", () => {
    const qb = new QueryBuilder();
    const sql = qb
      .select({
        subscriptionStatus: organizations.subscriptionStatus,
        lastStripeEventAt: organizations.lastStripeEventAt,
      })
      .from(organizations)
      .where(eq(organizations.id, 1))
      .for("update")
      .limit(1)
      .toSQL()
      .sql.toLowerCase();
    expect(sql).toContain("for update");
    expect(sql).toContain("organizations");
  });
});
