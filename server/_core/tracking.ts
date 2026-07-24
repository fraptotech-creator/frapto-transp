import type { TrackPoint } from "./trackIngest";

// Decisão PURA do rastreio: uma posição só é gravada se a viagem for do
// motorista logado E estiver EM ANDAMENTO. Fora disso, ignora em silêncio
// (o app pode mandar uma posição atrasada logo após concluir — não é erro).
export function canRecordPosition(
  trip: { motoristaId: number | null; status: string } | null | undefined,
  driverId: number
): boolean {
  if (!trip) return false;
  return trip.motoristaId === driverId && trip.status === "em_andamento";
}

// Velocidade plausível para veículo terrestre. Acima disto (ou negativa) é
// ruído do sensor / valor forjado — descarta a velocidade, mantém o ponto.
export const MAX_SPEED_KMH = 300;

export function sanitizeSpeed(speed: number | null): string | null {
  if (speed == null) return null;
  if (!Number.isFinite(speed) || speed < 0 || speed > MAX_SPEED_KMH)
    return null;
  return String(speed);
}

export interface TripRef {
  id: number;
  motoristaId: number | null;
  veiculoId: number;
  status: string;
}

export interface PlannedTrackRow {
  tripId: number;
  veiculoId: number;
  lat: string;
  lng: string;
  velocidade: string | null;
}

// Planejamento PURO da ingestão: dado o lote de pontos, a viagem ativa e um
// mapa de viagens já carregadas, decide QUAIS pontos viram linha (dono +
// em_andamento) e monta as linhas do INSERT em lote. Sem I/O — a borda
// (handleTrackIngest) resolve as viagens e faz o insert único.
export function planTrackInserts(params: {
  points: TrackPoint[];
  activeTripId: number; // -1 quando o motorista não tem viagem em andamento
  tripsById: Map<number, TripRef | null | undefined>;
  driverId: number;
}): PlannedTrackRow[] {
  const { points, activeTripId, tripsById, driverId } = params;
  const rows: PlannedTrackRow[] = [];
  for (const p of points) {
    const tripId = p.tripId ?? activeTripId;
    if (tripId < 0) continue;
    const trip = tripsById.get(tripId);
    if (!canRecordPosition(trip, driverId)) continue;
    rows.push({
      tripId: trip!.id,
      veiculoId: trip!.veiculoId,
      lat: String(p.lat),
      lng: String(p.lng),
      velocidade: sanitizeSpeed(p.speed),
    });
  }
  return rows;
}

// Conjunto de tripIds DISTINTOS que a borda precisa carregar do banco para o
// lote (resolve o fallback da viagem ativa). Evita um getTripById por ponto.
export function distinctTripIds(
  points: TrackPoint[],
  activeTripId: number
): number[] {
  const ids = new Set<number>();
  for (const p of points) {
    const tripId = p.tripId ?? activeTripId;
    if (tripId >= 0) ids.add(tripId);
  }
  return Array.from(ids);
}

// Velocidade do navegador vem em m/s (pode ser null). Converte p/ km/h.
export function speedMsToKmh(speed: number | null | undefined): number | null {
  if (speed == null || Number.isNaN(speed) || speed < 0) return null;
  return Math.round(speed * 3.6 * 100) / 100;
}
