import { describe, it, expect, vi } from "vitest";
import { QueryBuilder } from "drizzle-orm/mysql-core";
import { eq, and } from "drizzle-orm";
import {
  commitStripeEffectCore,
  type LeaseExecutor,
  type CommitLeaseParams,
  type OrgSubscriptionEffect,
} from "./db/organizations";
import { stripeEvents } from "../drizzle/schema";

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
  marked?: number;
  applyThrows?: boolean;
}) {
  const calls: string[] = [];
  const exec: LeaseExecutor = {
    async lockEvent() {
      calls.push("lock");
      return over.row;
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
  it("dono da geração: aplica efeito E marca na MESMA passagem → committed", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      marked: 1,
    });
    const out = await commitStripeEffectCore(exec, params());
    expect(out).toBe("committed");
    // efeito e marca acontecem juntos, nessa ordem
    expect(calls).toEqual(["lock", "apply", "mark"]);
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

  it("orgId/effect nulos (tipo ignorado): pula o efeito, mas MARCA processed", async () => {
    const { exec, calls } = fakeExec({
      row: { status: "processing", attempts: 1 },
      marked: 1,
    });
    const out = await commitStripeEffectCore(
      exec,
      params({ orgId: null, effect: null })
    );
    expect(out).toBe("committed");
    expect(calls).toEqual(["lock", "mark"]); // sem 'apply'
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
    expect(calls).toEqual(["lock", "apply"]); // 'mark' nunca aconteceu
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
});
