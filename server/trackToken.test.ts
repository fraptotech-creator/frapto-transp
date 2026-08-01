import { describe, it, expect } from "vitest";
import {
  hashTrackingToken,
  trackingTokenBloqueado,
  TRACKING_TOKEN_TTL_MS,
} from "./_core/tracking";

describe("hashTrackingToken", () => {
  it("SHA-256 hex de 64 chars, determinístico, distinto por token", () => {
    const a = hashTrackingToken("a".repeat(48));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashTrackingToken("a".repeat(48))).toBe(a);
    expect(hashTrackingToken("b".repeat(48))).not.toBe(a);
  });
});

describe("trackingTokenBloqueado", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  it("revogado sempre bloqueia", () => {
    expect(
      trackingTokenBloqueado({ trackingTokenRevokedAt: new Date() }, now)
    ).toBe(true);
  });
  it("expirado bloqueia; futuro não", () => {
    expect(
      trackingTokenBloqueado(
        { trackingTokenExpiresAt: new Date(now.getTime() - 1) },
        now
      )
    ).toBe(true);
    expect(
      trackingTokenBloqueado(
        {
          trackingTokenExpiresAt: new Date(
            now.getTime() + TRACKING_TOKEN_TTL_MS
          ),
        },
        now
      )
    ).toBe(false);
  });
  it("legado sem expiração NÃO é bloqueado (migra no ping)", () => {
    expect(trackingTokenBloqueado({}, now)).toBe(false);
    expect(
      trackingTokenBloqueado(
        { trackingTokenExpiresAt: null, trackingTokenRevokedAt: null },
        now
      )
    ).toBe(false);
  });
});
