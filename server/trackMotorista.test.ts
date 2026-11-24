import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// API do APP NATIVO do motorista (24/11/2026): token no Bearer → mesmo
// procedimento tRPC do app web. Banco mockado no MESMO módulo que o router usa.
const db = vi.hoisted(() => ({
  getDriverByTrackingToken: vi.fn(),
  getDriverUser: vi.fn(),
  getOrganization: vi.fn(),
  getDriverById: vi.fn(),
  getTrips: vi.fn(),
  getTripById: vi.fn(),
  updateTrip: vi.fn(),
  accrueTripKm: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...db };
});

import {
  handleConcluirViagem,
  handleIniciarViagem,
  handleListarViagens,
} from "./routers/trackMotorista";

const TOKEN = "e".repeat(48);
const motorista = { id: 3, orgId: 7, nome: "João", status: "ativo" };
const usuario = {
  id: 50,
  openId: "drv",
  orgId: 7,
  driverId: 3,
  orgRole: "driver",
  mustChangePassword: false,
  sessionVersion: 0,
};
const viagem = (o: Record<string, unknown>) => ({
  id: 10,
  orgId: 7,
  motoristaId: 3,
  veiculoId: 1,
  status: "planejada",
  valor: "900.00",
  ...o,
});

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
const req = (o: {
  auth?: string;
  params?: Record<string, string>;
  body?: unknown;
}) =>
  ({
    headers: o.auth ? { authorization: o.auth } : {},
    params: o.params ?? {},
    body: o.body,
  }) as unknown as Request;

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.getDriverByTrackingToken.mockResolvedValue(motorista);
  db.getDriverUser.mockResolvedValue(usuario);
  db.getOrganization.mockResolvedValue({ subscriptionStatus: "active" });
  db.getDriverById.mockResolvedValue(motorista);
});

describe("autenticação pelo token", () => {
  it("sem Bearer → 401, sem tocar no banco", async () => {
    const { res, r } = fakeRes();
    await handleListarViagens(req({}), res);
    expect(r.code).toBe(401);
    expect(db.getDriverByTrackingToken).not.toHaveBeenCalled();
  });

  it("token desconhecido → 401", async () => {
    db.getDriverByTrackingToken.mockResolvedValue(undefined);
    const { res, r } = fakeRes();
    await handleListarViagens(req({ auth: `Bearer ${TOKEN}` }), res);
    expect(r.code).toBe(401);
  });

  it("token revogado → 401", async () => {
    db.getDriverByTrackingToken.mockResolvedValue({
      ...motorista,
      trackingTokenRevokedAt: new Date(Date.now() - 1000),
    });
    const { res, r } = fakeRes();
    await handleListarViagens(req({ auth: `Bearer ${TOKEN}` }), res);
    expect(r.code).toBe(401);
  });

  it("motorista INATIVO → 403 (regra do driverProcedure)", async () => {
    db.getDriverById.mockResolvedValue({ ...motorista, status: "inativo" });
    const { res, r } = fakeRes();
    await handleListarViagens(req({ auth: `Bearer ${TOKEN}` }), res);
    expect(r.code).toBe(403);
  });

  it("assinatura inativa → 403", async () => {
    db.getOrganization.mockResolvedValue({ subscriptionStatus: "canceled" });
    const { res, r } = fakeRes();
    await handleListarViagens(req({ auth: `Bearer ${TOKEN}` }), res);
    expect(r.code).toBe(403);
  });
});

describe("viagens do motorista", () => {
  it("lista só as DELE, ativas e SEM o valor", async () => {
    db.getTrips.mockResolvedValue([
      viagem({ id: 10 }),
      viagem({ id: 11, motoristaId: 99 }),
      viagem({ id: 12, status: "concluida" }),
    ]);
    const { res, r } = fakeRes();
    await handleListarViagens(req({ auth: `Bearer ${TOKEN}` }), res);
    expect(r.code).toBe(200);
    const { viagens } = r.body as { viagens: Record<string, unknown>[] };
    expect(viagens.map(v => v.id)).toEqual([10]);
    expect(viagens[0]).not.toHaveProperty("valor");
    expect(db.getTrips).toHaveBeenCalledWith(7);
  });

  it("inicia a viagem dele", async () => {
    db.getTripById.mockResolvedValue(viagem({}));
    const { res, r } = fakeRes();
    await handleIniciarViagem(
      req({ auth: `Bearer ${TOKEN}`, params: { id: "10" } }),
      res
    );
    expect(r.code).toBe(200);
    expect(db.updateTrip).toHaveBeenCalledWith(7, 10, {
      status: "em_andamento",
    });
  });

  it("viagem de OUTRO motorista → 404, nada muda", async () => {
    db.getTripById.mockResolvedValue(viagem({ motoristaId: 99 }));
    const { res, r } = fakeRes();
    await handleIniciarViagem(
      req({ auth: `Bearer ${TOKEN}`, params: { id: "10" } }),
      res
    );
    expect(r.code).toBe(404);
    expect(db.updateTrip).not.toHaveBeenCalled();
  });

  it("conclui com a hora de chegada e soma o km", async () => {
    db.getTripById.mockResolvedValue(viagem({ status: "em_andamento" }));
    const { res, r } = fakeRes();
    await handleConcluirViagem(
      req({
        auth: `Bearer ${TOKEN}`,
        params: { id: "10" },
        body: { dataChegada: "2026-11-24T15:30:00.000Z" },
      }),
      res
    );
    expect(r.code).toBe(200);
    expect(db.updateTrip).toHaveBeenCalledWith(7, 10, {
      status: "concluida",
      dataChegada: new Date("2026-11-24T15:30:00.000Z"),
    });
    expect(db.accrueTripKm).toHaveBeenCalledWith(7, 10);
  });

  it("concluir sem hora de chegada válida → 400 antes de autenticar", async () => {
    const { res, r } = fakeRes();
    await handleConcluirViagem(
      req({
        auth: `Bearer ${TOKEN}`,
        params: { id: "10" },
        body: { dataChegada: "ontem" },
      }),
      res
    );
    expect(r.code).toBe(400);
    expect(db.updateTrip).not.toHaveBeenCalled();
  });

  it("id inválido na rota → 400", async () => {
    const { res, r } = fakeRes();
    await handleIniciarViagem(
      req({ auth: `Bearer ${TOKEN}`, params: { id: "abc" } }),
      res
    );
    expect(r.code).toBe(400);
  });
});
