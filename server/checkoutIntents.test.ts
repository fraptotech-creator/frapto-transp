import { describe, it, expect } from "vitest";
import {
  decideCheckoutIntent,
  claimCheckoutIntentCore,
  type CheckoutIntentExecutor,
  type CheckoutIntentRow,
} from "./db/checkoutIntents";

const NOW = new Date("2026-08-03T12:00:00Z");
const OLD = new Date("2026-08-03T11:00:00Z"); // 1h atrás (bem além de qualquer stale)

describe("decideCheckoutIntent — exactly-once mesmo após crash (item 3)", () => {
  it("sem linha → cria chave nova", () => {
    expect(decideCheckoutIntent(undefined, NOW, "K")).toEqual({
      action: "create",
      key: "K",
    });
  });

  it("url válida (não expirada) → reusa a MESMA url", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: NOW,
    };
    expect(decideCheckoutIntent(row, NOW, "K")).toEqual({
      action: "reuse",
      key: "A",
      url: "https://sess",
    });
  });

  it("url EXPIRADA (prova) → cria chave nova (K2 seguro; a antiga não é pagável)", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: OLD,
    };
    expect(decideCheckoutIntent(row, NOW, "K").action).toBe("create");
  });

  it("CRASH: em progresso SEM url, RECENTE → reusa a chave (recuperação, não K2)", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: new Date(NOW.getTime() - 1000),
    };
    expect(decideCheckoutIntent(row, NOW, "K")).toEqual({
      action: "reuse",
      key: "A",
      url: null,
    });
  });

  it("CRASH: em progresso SEM url, ANTIGO (>2min) → AINDA reusa K1 (NUNCA K2)", () => {
    // Este é o furo que o item 3 fecha: antes trocava por K2 após 2min → duas
    // sessões pagáveis. Agora recupera K1 (re-chamar Stripe com a mesma chave
    // devolve a sessão original).
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: OLD,
    };
    expect(decideCheckoutIntent(row, NOW, "K")).toEqual({
      action: "reuse",
      key: "A",
      url: null,
    });
  });
});

function fakeStore(seed?: CheckoutIntentRow & { orgId: number }) {
  let row = seed;
  const exec: CheckoutIntentExecutor = {
    async insertNew(orgId, key, now) {
      if (row) return false;
      row = {
        orgId,
        idempotencyKey: key,
        sessionUrl: null,
        expiresAt: null,
        createdAt: now,
      };
      return true;
    },
    async read() {
      return row ? { ...row } : undefined;
    },
    async recreate(orgId, expectedKey, newKey, now) {
      if (row && row.idempotencyKey === expectedKey) {
        row = {
          orgId,
          idempotencyKey: newKey,
          sessionUrl: null,
          expiresAt: null,
          createdAt: now,
        };
        return 1;
      }
      return 0;
    },
  };
  return { exec, get: () => row };
}

describe("claimCheckoutIntentCore — coordenação durável (item 3)", () => {
  it("primeira chamada GANHA (INSERT) → chave nova", async () => {
    const s = fakeStore();
    expect(
      await claimCheckoutIntentCore(s.exec, { orgId: 1, newKey: "A", now: NOW })
    ).toEqual({ key: "A", url: null });
  });

  it("2ª réplica (em progresso) REUSA a mesma chave", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: NOW,
    });
    expect(
      await claimCheckoutIntentCore(s.exec, { orgId: 1, newKey: "B", now: NOW })
    ).toEqual({ key: "A", url: null });
  });

  it("CRASH antigo (sem url) → reusa K1, NÃO cria K2", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: OLD,
    });
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B",
      now: NOW,
    });
    expect(r.key).toBe("A"); // recuperação; jamais B
    expect(s.get()?.idempotencyKey).toBe("A");
  });

  it("url válida → devolve a url (sem nova sessão)", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: NOW,
    });
    expect(
      await claimCheckoutIntentCore(s.exec, { orgId: 1, newKey: "B", now: NOW })
    ).toEqual({ key: "A", url: "https://sess" });
  });

  it("url EXPIRADA → recria com chave nova (CAS)", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://old",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: OLD,
    });
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B",
      now: NOW,
    });
    expect(r).toEqual({ key: "B", url: null });
    expect(s.get()?.idempotencyKey).toBe("B");
  });

  it("duas réplicas na EXPIRADA convergem para uma única chave", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://old",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: OLD,
    });
    const r1 = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B1",
      now: NOW,
    });
    const r2 = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B2",
      now: NOW,
    });
    expect(r1.key).toBe("B1");
    expect(r2.key).toBe("B1"); // convergiu
  });
});
