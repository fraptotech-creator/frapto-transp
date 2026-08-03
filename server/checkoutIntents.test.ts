import { describe, it, expect } from "vitest";
import {
  decideCheckoutIntent,
  claimCheckoutIntentCore,
  type CheckoutIntentExecutor,
  type CheckoutIntentRow,
} from "./db/checkoutIntents";

const STALE = 2 * 60 * 1000;
const NOW = new Date("2026-08-03T12:00:00Z");

describe("decideCheckoutIntent — reuso × recriação (item 1)", () => {
  it("sem linha → cria chave nova", () => {
    expect(decideCheckoutIntent(undefined, NOW, "K", STALE)).toEqual({
      action: "create",
      key: "K",
    });
  });

  it("sessão válida (url + não expirada) → reusa a MESMA url", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: NOW,
    };
    expect(decideCheckoutIntent(row, NOW, "K", STALE)).toEqual({
      action: "reuse",
      key: "A",
      url: "https://sess",
    });
  });

  it("em progresso recente (sem url) → reusa a CHAVE (Stripe dedupe), sem url", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: new Date(NOW.getTime() - 1000),
    };
    expect(decideCheckoutIntent(row, NOW, "K", STALE)).toEqual({
      action: "reuse",
      key: "A",
      url: null,
    });
  });

  it("sessão EXPIRADA → cria chave nova", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: new Date(NOW.getTime() - 10_000),
    };
    expect(decideCheckoutIntent(row, NOW, "K", STALE).action).toBe("create");
  });

  it("em progresso ABANDONADO (sem url, antigo) → cria chave nova", () => {
    const row: CheckoutIntentRow = {
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: new Date(NOW.getTime() - STALE - 1),
    };
    expect(decideCheckoutIntent(row, NOW, "K", STALE).action).toBe("create");
  });
});

// Store em memória modelando a semântica do banco: insertNew falha se já existe;
// recreate é CAS (só troca se a chave atual for a esperada).
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

describe("claimCheckoutIntentCore — coordenação durável (item 1)", () => {
  it("primeira chamada GANHA a corrida (INSERT) → chave nova", async () => {
    const s = fakeStore();
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "A",
      now: NOW,
      staleMs: STALE,
    });
    expect(r).toEqual({ key: "A", url: null });
    expect(s.get()?.idempotencyKey).toBe("A");
  });

  it("2ª chamada concorrente (réplica) REUSA a mesma chave, sem url", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: null,
      expiresAt: null,
      createdAt: NOW,
    });
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B",
      now: NOW,
      staleMs: STALE,
    });
    expect(r).toEqual({ key: "A", url: null }); // dedup: mesma chave que a 1ª
  });

  it("sessão válida existente → devolve a url (nenhuma sessão nova)", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://sess",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: NOW,
    });
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B",
      now: NOW,
      staleMs: STALE,
    });
    expect(r).toEqual({ key: "A", url: "https://sess" });
  });

  it("expirada → recria com chave nova (CAS vence)", async () => {
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://old",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: new Date(NOW.getTime() - 10_000),
    });
    const r = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B",
      now: NOW,
      staleMs: STALE,
    });
    expect(r).toEqual({ key: "B", url: null });
    expect(s.get()?.idempotencyKey).toBe("B");
  });

  it("duas réplicas recriando a expirada CONVERGEM para uma única chave", async () => {
    // store compartilhado começa expirado; a 1ª recria p/ B1, a 2ª (que também
    // viu 'A') perde o CAS e deve reusar B1 — não criar B2.
    const s = fakeStore({
      orgId: 1,
      idempotencyKey: "A",
      sessionUrl: "https://old",
      expiresAt: new Date(NOW.getTime() - 1000),
      createdAt: new Date(NOW.getTime() - 10_000),
    });
    const r1 = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B1",
      now: NOW,
      staleMs: STALE,
    });
    // 2ª réplica: a linha já é B1 (recente, sem url) → reusa B1.
    const r2 = await claimCheckoutIntentCore(s.exec, {
      orgId: 1,
      newKey: "B2",
      now: NOW,
      staleMs: STALE,
    });
    expect(r1.key).toBe("B1");
    expect(r2.key).toBe("B1"); // convergiu — não virou B2
    expect(s.get()?.idempotencyKey).toBe("B1");
  });
});
