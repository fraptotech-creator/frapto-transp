import { describe, it, expect } from "vitest";
import { trackTokenKey } from "./_core/security";
import { normalizeTrackPayload, TRACK_TOKEN_RE } from "./_core/trackIngest";

const TOKEN_A = "a".repeat(48); // 48 hex = formato real
const TOKEN_B = "b".repeat(48);

describe("TRACK_TOKEN_RE / formato do token (P-plan Lote 1)", () => {
  it("aceita só 48 hex minúsculos", () => {
    expect(TRACK_TOKEN_RE.test(TOKEN_A)).toBe(true);
    expect(TRACK_TOKEN_RE.test("A".repeat(48))).toBe(false); // maiúsculo
    expect(TRACK_TOKEN_RE.test("a".repeat(47))).toBe(false); // curto
    expect(TRACK_TOKEN_RE.test("a".repeat(49))).toBe(false); // longo
    expect(TRACK_TOKEN_RE.test("z".repeat(48))).toBe(false); // não-hex
  });
});

describe("trackTokenKey — chave de rate-limit à prova de DoS de memória", () => {
  it("token de 1 MB NÃO vira chave (cai no IP via null)", () => {
    const huge = "x".repeat(1_000_000);
    expect(trackTokenKey(huge)).toBeNull();
  });

  it("tokens inválidos distintos compartilham o fallback (null → IP)", () => {
    expect(trackTokenKey("lixo1")).toBeNull();
    expect(trackTokenKey("lixo2")).toBeNull();
    expect(trackTokenKey("")).toBeNull();
  });

  it("token válido vira chave de tamanho FIXO (hash), independente por token", () => {
    const ka = trackTokenKey(TOKEN_A);
    const kb = trackTokenKey(TOKEN_B);
    expect(ka).toMatch(/^tok:[0-9a-f]{64}$/); // SHA-256 hex, tamanho fixo
    expect(kb).toMatch(/^tok:[0-9a-f]{64}$/);
    expect(ka).not.toBe(kb); // frotas com tokens diferentes não colidem
    expect(trackTokenKey(TOKEN_A)).toBe(ka); // determinístico
  });
});

describe("normalizeTrackPayload — token e lotes reais", () => {
  it("descarta token fora do formato (não deixa string gigante seguir)", () => {
    expect(
      normalizeTrackPayload({ token: "x".repeat(100000), locations: [] }).token
    ).toBeNull();
    expect(normalizeTrackPayload({ token: TOKEN_A, locations: [] }).token).toBe(
      TOKEN_A
    );
  });

  it("aceita lote real de 1, 50 e 500 pontos", () => {
    const pt = (i: number) => ({ lat: -23.5 + i / 1e5, lng: -46.6, speed: 40 });
    for (const n of [1, 50, 500]) {
      const pts = Array.from({ length: n }, (_, i) => pt(i));
      const out = normalizeTrackPayload({ token: TOKEN_A, locations: pts });
      expect(out.points.length, `${n} pontos`).toBe(n);
    }
  });

  it("respeita o teto de 500 pontos por requisição", () => {
    const pts = Array.from({ length: 800 }, () => ({ lat: -23.5, lng: -46.6 }));
    const out = normalizeTrackPayload({ token: TOKEN_A, locations: pts });
    expect(out.points.length).toBe(500);
  });
});
