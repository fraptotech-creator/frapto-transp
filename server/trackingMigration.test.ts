import { describe, it, expect, vi } from "vitest";
import {
  migrateTrackingTokenToHashCore,
  type TokenMigrateExecutor,
} from "./db/fleet";

// Linha de motorista em memória modelando o CAS do banco: casMigrate só troca
// se trackingToken ainda for o token apresentado E trackingTokenHash IS NULL.
function fakeStore(seed: {
  orgId: number;
  id: number;
  trackingToken: string | null;
  trackingTokenHash: string | null;
}) {
  const row = { ...seed };
  const exec: TokenMigrateExecutor = {
    async casMigrate(orgId, driverId, token) {
      if (
        row.orgId === orgId &&
        row.id === driverId &&
        row.trackingToken === token &&
        row.trackingTokenHash === null
      ) {
        row.trackingToken = null;
        row.trackingTokenHash = `hash(${token})`;
        return 1;
      }
      return 0;
    },
  };
  return { exec, row };
}

describe("migrateTrackingTokenToHash — CAS anti-corrida (item 3)", () => {
  it("ingestão legada normal MIGRA uma vez (2ª chamada é no-op)", async () => {
    const s = fakeStore({
      orgId: 1,
      id: 5,
      trackingToken: "OLD",
      trackingTokenHash: null,
    });
    expect(await migrateTrackingTokenToHashCore(s.exec, 1, 5, "OLD")).toBe(
      true
    );
    expect(s.row.trackingTokenHash).toBe("hash(OLD)");
    expect(s.row.trackingToken).toBeNull();
    // 2ª ingestão com o mesmo legado: já migrado → não migra de novo.
    expect(await migrateTrackingTokenToHashCore(s.exec, 1, 5, "OLD")).toBe(
      false
    );
  });

  it("login CONCORRENTE (token novo) NÃO é sobrescrito pela migração do legado", async () => {
    const s = fakeStore({
      orgId: 1,
      id: 5,
      trackingToken: "OLD",
      trackingTokenHash: null,
    });
    // login roda ANTES: issueTrackingToken zera o claro e grava o hash NOVO.
    s.row.trackingToken = null;
    s.row.trackingTokenHash = "hash(NEW)";
    // agora a ingestão legada tenta migrar o token OLD:
    const migrou = await migrateTrackingTokenToHashCore(s.exec, 1, 5, "OLD");
    expect(migrou).toBe(false); // CAS não casa (token já não é OLD)
    expect(s.row.trackingTokenHash).toBe("hash(NEW)"); // token novo PRESERVADO
  });

  it("driver de OUTRA org/id não é migrado (escopo)", async () => {
    const s = fakeStore({
      orgId: 1,
      id: 5,
      trackingToken: "OLD",
      trackingTokenHash: null,
    });
    expect(await migrateTrackingTokenToHashCore(s.exec, 2, 5, "OLD")).toBe(
      false
    );
    expect(await migrateTrackingTokenToHashCore(s.exec, 1, 9, "OLD")).toBe(
      false
    );
  });

  it("não loga o token bruto durante a migração", async () => {
    const s = fakeStore({
      orgId: 1,
      id: 5,
      trackingToken: "SEGREDO",
      trackingTokenHash: null,
    });
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
    await migrateTrackingTokenToHashCore(s.exec, 1, 5, "SEGREDO");
    for (const sp of spies) {
      for (const call of sp.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("SEGREDO");
      }
      sp.mockRestore();
    }
  });
});
