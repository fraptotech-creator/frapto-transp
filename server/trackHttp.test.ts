import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mocks do banco: os handlers do /api/track importam de "../db"; aqui o test
// mora em server/ e "./db" resolve para o MESMO módulo (registry por caminho
// absoluto), então o mock intercepta o que o handler usa.
const db = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getDriverById: vi.fn(),
  getOrganization: vi.fn(),
  issueTrackingToken: vi.fn().mockResolvedValue("t".repeat(48)),
  migrateTrackingTokenToHash: vi.fn(),
  revokeTrackingToken: vi.fn(),
  getDriverByTrackingToken: vi.fn(),
  getTrips: vi.fn(),
  getTripById: vi.fn(),
  addTripPositions: vi.fn(),
}));
vi.mock("./db", () => db);
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn().mockResolvedValue(true) },
}));

import { handleTrackLogin, handleTrackIngest } from "./routers/trackHttp";

// Fake de Response: captura status/json sem subir Express.
function fakeRes() {
  const r: { code: number; body: unknown } = { code: 0, body: null };
  const res = {
    status(c: number) {
      r.code = c;
      return res;
    },
    json(b: unknown) {
      r.body = b;
      return res;
    },
  } as unknown as Response;
  return { res, r };
}

const req = (body: unknown) => ({ body }) as Request;

const driverUser = {
  orgId: 7,
  driverId: 3,
  orgRole: "driver",
  passwordHash: "hash",
};

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe("/api/track/login — gate de assinatura", () => {
  beforeEach(() => {
    db.getUserByUsername.mockResolvedValue(driverUser);
    db.getDriverById.mockResolvedValue({
      id: 3,
      orgId: 7,
      nome: "João",
      trackingToken: null,
    });
  });

  it("NEGA (402) quando a org está inadimplente — não emite token", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "past_due" });
    const { res, r } = fakeRes();
    await handleTrackLogin(req({ username: "joao", password: "x" }), res);
    expect(r.code).toBe(402);
    expect(db.issueTrackingToken).not.toHaveBeenCalled();
  });

  it("emite token NOVO (rotação) quando a assinatura está ativa", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
    const { res, r } = fakeRes();
    await handleTrackLogin(req({ username: "joao", password: "x" }), res);
    expect(r.code).toBe(200);
    expect(db.issueTrackingToken).toHaveBeenCalledOnce();
  });
});

describe("/api/track — gate de assinatura na ingestão", () => {
  // Token no formato real (48 hex) — a normalização agora rejeita outros.
  const ponto = { token: "a".repeat(48), lat: -23.5, lng: -46.6, tripId: 1 };
  beforeEach(() => {
    db.getDriverByTrackingToken.mockResolvedValue({ id: 3, orgId: 7 });
    db.getTripById.mockResolvedValue({
      id: 1,
      motoristaId: 3,
      veiculoId: 9,
      status: "em_andamento",
    });
  });

  it("NEGA (402) e NÃO grava posição quando a org está inadimplente", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "canceled" });
    const { res, r } = fakeRes();
    await handleTrackIngest(req(ponto), res);
    expect(r.code).toBe(402);
    expect(db.addTripPositions).not.toHaveBeenCalled();
  });

  it("grava posição EM LOTE quando a assinatura está ativa", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
    const { res, r } = fakeRes();
    await handleTrackIngest(req(ponto), res);
    expect(r.code).toBe(200);
    // Um único INSERT em lote (não um por ponto).
    expect(db.addTripPositions).toHaveBeenCalledOnce();
    expect(r.body).toEqual({ recorded: 1 });
  });

  it("REJEITA (401) token REVOGADO e NÃO grava (Lote 7.2)", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
    db.getDriverByTrackingToken.mockResolvedValue({
      id: 3,
      orgId: 7,
      trackingTokenRevokedAt: new Date(),
    });
    const { res, r } = fakeRes();
    await handleTrackIngest(req(ponto), res);
    expect(r.code).toBe(401);
    expect(db.addTripPositions).not.toHaveBeenCalled();
  });

  it("REJEITA (401) token EXPIRADO e NÃO grava (Lote 7.2)", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
    db.getDriverByTrackingToken.mockResolvedValue({
      id: 3,
      orgId: 7,
      trackingTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const { res, r } = fakeRes();
    await handleTrackIngest(req(ponto), res);
    expect(r.code).toBe(401);
    expect(db.addTripPositions).not.toHaveBeenCalled();
  });

  it("MIGRA aparelho legado (sem hash) para hash no primeiro ping", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
    // driver sem trackingTokenHash = legado (achado pelo valor em claro)
    db.getDriverByTrackingToken.mockResolvedValue({
      id: 3,
      orgId: 7,
      trackingTokenHash: null,
    });
    const { res, r } = fakeRes();
    await handleTrackIngest(req(ponto), res);
    expect(r.code).toBe(200);
    expect(db.migrateTrackingTokenToHash).toHaveBeenCalledOnce();
  });
});
