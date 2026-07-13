import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { normalizeTrackPayload } from "../_core/trackIngest";
import { canRecordPosition } from "../_core/tracking";
import {
  getDriverByTrackingToken,
  getUserByUsername,
  getDriverById,
  setDriverTrackingToken,
  getTripById,
  getTrips,
  addTripPosition,
} from "../db";

// Login REST do app NATIVO de rastreio (sem tRPC/superjson). Valida
// usuário+senha do motorista e devolve o token de rastreio. Fail-closed;
// protegido por rate-limit estrito na borda (authLimiter).
export async function handleTrackLogin(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username =
      typeof body.username === "string"
        ? body.username.toLowerCase().trim()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      res.status(400).json({ error: "informe usuário e senha" });
      return;
    }
    const user = await getUserByUsername(username);
    if (
      !user ||
      !user.passwordHash ||
      user.orgRole !== "driver" ||
      !user.orgId ||
      !user.driverId
    ) {
      res.status(401).json({ error: "usuário ou senha inválidos" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "usuário ou senha inválidos" });
      return;
    }
    const driver = await getDriverById(user.orgId, user.driverId);
    if (!driver) {
      res.status(401).json({ error: "motorista não encontrado" });
      return;
    }
    let token = driver.trackingToken;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await setDriverTrackingToken(user.orgId, user.driverId, token);
    }
    res.status(200).json({ token, nome: driver.nome });
  } catch (err) {
    console.error(
      "[track] login error",
      err instanceof Error ? err.message : err
    );
    res.status(500).json({ error: "erro interno" });
  }
}

// Ingestão de posição do app NATIVO (GPS em segundo plano). Autenticado por
// token de motorista — org/driverId saem do registro do token, nunca do
// cliente. Só grava se a viagem for do motorista E estiver em andamento
// (canRecordPosition), igual ao caminho do tRPC. Fail-closed em tudo.
export async function handleTrackIngest(req: Request, res: Response) {
  try {
    const { token, points } = normalizeTrackPayload(req.body);
    if (!token || points.length === 0) {
      res.status(400).json({ error: "payload inválido" });
      return;
    }
    const driver = await getDriverByTrackingToken(token);
    if (!driver) {
      res.status(401).json({ error: "token inválido" });
      return;
    }

    // Viagem ativa do motorista (fallback quando o ponto não traz tripId).
    let activeTripId: number | undefined;
    const resolveActive = async (): Promise<number> => {
      if (activeTripId !== undefined) return activeTripId;
      const trips = await getTrips(driver.orgId);
      const active = trips.find(
        t => t.motoristaId === driver.id && t.status === "em_andamento"
      );
      activeTripId = active ? active.id : -1;
      return activeTripId;
    };

    let recorded = 0;
    for (const p of points) {
      const tripId = p.tripId ?? (await resolveActive());
      if (tripId < 0) continue;
      const trip = await getTripById(driver.orgId, tripId);
      if (!trip || !canRecordPosition(trip, driver.id)) continue;
      await addTripPosition(driver.orgId, {
        tripId: trip.id,
        veiculoId: trip.veiculoId,
        lat: String(p.lat),
        lng: String(p.lng),
        velocidade: p.speed != null ? String(p.speed) : null,
      });
      recorded++;
    }
    res.status(200).json({ recorded });
  } catch (err) {
    console.error(
      "[track] ingest error",
      err instanceof Error ? err.message : err
    );
    res.status(500).json({ error: "erro interno" });
  }
}
