import { describe, it, expect } from "vitest";
import {
  planTrackInserts,
  distinctTripIds,
  sanitizeSpeed,
  type TripRef,
} from "./_core/tracking";
import type { TrackPoint } from "./_core/trackIngest";

const pt = (o: Partial<TrackPoint>): TrackPoint => ({
  tripId: null,
  lat: -23.5,
  lng: -46.6,
  speed: null,
  ...o,
});

const trip = (o: Partial<TripRef>): TripRef => ({
  id: 1,
  motoristaId: 3,
  veiculoId: 9,
  status: "em_andamento",
  ...o,
});

describe("sanitizeSpeed", () => {
  it("mantém velocidade plausível", () => {
    expect(sanitizeSpeed(0)).toBe("0");
    expect(sanitizeSpeed(87.5)).toBe("87.5");
    expect(sanitizeSpeed(300)).toBe("300");
  });
  it("descarta negativa, absurda e não-finita", () => {
    expect(sanitizeSpeed(-1)).toBeNull();
    expect(sanitizeSpeed(301)).toBeNull();
    expect(sanitizeSpeed(Infinity)).toBeNull();
    expect(sanitizeSpeed(NaN)).toBeNull();
  });
  it("null continua null", () => {
    expect(sanitizeSpeed(null)).toBeNull();
  });
});

describe("distinctTripIds", () => {
  it("dedup e usa a viagem ativa no fallback", () => {
    const ids = distinctTripIds(
      [pt({ tripId: 1 }), pt({ tripId: 1 }), pt({ tripId: null })],
      5 // ativa
    );
    expect(ids.sort()).toEqual([1, 5]);
  });
  it("ignora pontos sem viagem ativa (activeTripId = -1)", () => {
    expect(distinctTripIds([pt({ tripId: null })], -1)).toEqual([]);
  });
});

describe("planTrackInserts", () => {
  const tripsById = new Map<number, TripRef | null | undefined>([
    [1, trip({ id: 1 })],
  ]);

  it("monta linha só para viagem do dono E em andamento", () => {
    const rows = planTrackInserts({
      points: [pt({ tripId: 1, speed: 50 })],
      activeTripId: -1,
      tripsById,
      driverId: 3,
    });
    expect(rows).toEqual([
      { tripId: 1, veiculoId: 9, lat: "-23.5", lng: "-46.6", velocidade: "50" },
    ]);
  });

  it("descarta ponto de viagem de OUTRO motorista (fail-closed)", () => {
    const m = new Map<number, TripRef | null | undefined>([
      [1, trip({ id: 1, motoristaId: 99 })],
    ]);
    const rows = planTrackInserts({
      points: [pt({ tripId: 1 })],
      activeTripId: -1,
      tripsById: m,
      driverId: 3,
    });
    expect(rows).toHaveLength(0);
  });

  it("descarta ponto de viagem concluída", () => {
    const m = new Map<number, TripRef | null | undefined>([
      [1, trip({ id: 1, status: "concluida" })],
    ]);
    const rows = planTrackInserts({
      points: [pt({ tripId: 1 })],
      activeTripId: -1,
      tripsById: m,
      driverId: 3,
    });
    expect(rows).toHaveLength(0);
  });

  it("usa a viagem ativa quando o ponto não traz tripId", () => {
    const rows = planTrackInserts({
      points: [pt({ tripId: null })],
      activeTripId: 1,
      tripsById,
      driverId: 3,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].tripId).toBe(1);
  });

  it("descarta velocidade absurda mas mantém o ponto", () => {
    const rows = planTrackInserts({
      points: [pt({ tripId: 1, speed: 9999 })],
      activeTripId: -1,
      tripsById,
      driverId: 3,
    });
    expect(rows[0].velocidade).toBeNull();
  });
});
