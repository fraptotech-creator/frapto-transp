import type { Request, Response } from "express";
import { normalizeTrackPayload } from "../_core/trackIngest";
import { canRecordPosition } from "../_core/tracking";
import {
  getDriverByTrackingToken,
  getTripById,
  getTrips,
  addTripPosition,
} from "../db";

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
