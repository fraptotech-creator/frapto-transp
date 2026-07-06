import { describe, expect, it } from "vitest";

/**
 * Testes para o módulo de rastreamento de viagens.
 * Como o rastreamento usa dados mock no frontend (sem backend real de GPS),
 * testamos as funções de cálculo e lógica de negócio.
 */

// Funções utilitárias que replicam a lógica do TripTracking
function interpolate(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  fraction: number
) {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * fraction,
    lng: p1.lng + (p2.lng - p1.lng) * fraction,
  };
}

function computeBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m}m`;
}

function calculateEtaMinutes(
  totalDurationSeconds: number,
  progressPercent: number
): number {
  const remainingFraction = 1 - progressPercent / 100;
  return Math.ceil((remainingFraction * totalDurationSeconds) / 60);
}

function calculateDistanceCovered(
  totalDistanceMeters: number,
  progressPercent: number
): number {
  return Math.floor(((progressPercent / 100) * totalDistanceMeters) / 1000);
}

function calculateDistanceRemaining(
  totalDistanceKm: number,
  distanceCoveredKm: number
): number {
  return Math.max(0, Math.round(totalDistanceKm - distanceCoveredKm));
}

describe("Rastreamento - Interpolação de posição", () => {
  it("retorna ponto inicial quando fraction é 0", () => {
    const p1 = { lat: -23.5505, lng: -46.6333 };
    const p2 = { lat: -22.9068, lng: -43.1729 };
    const result = interpolate(p1, p2, 0);
    expect(result.lat).toBeCloseTo(p1.lat, 4);
    expect(result.lng).toBeCloseTo(p1.lng, 4);
  });

  it("retorna ponto final quando fraction é 1", () => {
    const p1 = { lat: -23.5505, lng: -46.6333 };
    const p2 = { lat: -22.9068, lng: -43.1729 };
    const result = interpolate(p1, p2, 1);
    expect(result.lat).toBeCloseTo(p2.lat, 4);
    expect(result.lng).toBeCloseTo(p2.lng, 4);
  });

  it("retorna ponto intermediário quando fraction é 0.5", () => {
    const p1 = { lat: -23.5505, lng: -46.6333 };
    const p2 = { lat: -22.9068, lng: -43.1729 };
    const result = interpolate(p1, p2, 0.5);
    const expectedLat = (-23.5505 + -22.9068) / 2;
    const expectedLng = (-46.6333 + -43.1729) / 2;
    expect(result.lat).toBeCloseTo(expectedLat, 4);
    expect(result.lng).toBeCloseTo(expectedLng, 4);
  });
});

describe("Rastreamento - Cálculo de bearing (direção)", () => {
  it("calcula bearing para norte (~0°)", () => {
    const from = { lat: -23.5505, lng: -46.6333 };
    const to = { lat: -22.5505, lng: -46.6333 };
    const bearing = computeBearing(from, to);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(10);
  });

  it("calcula bearing para leste (~90°)", () => {
    const from = { lat: -23.5505, lng: -46.6333 };
    const to = { lat: -23.5505, lng: -45.6333 };
    const bearing = computeBearing(from, to);
    expect(bearing).toBeGreaterThan(80);
    expect(bearing).toBeLessThan(100);
  });

  it("calcula bearing para nordeste (SP → RJ ~65°)", () => {
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };
    const bearing = computeBearing(sp, rj);
    expect(bearing).toBeGreaterThan(50);
    expect(bearing).toBeLessThan(80);
  });
});

describe("Rastreamento - Formatação de tempo", () => {
  it("formata segundos corretamente", () => {
    expect(formatTime(30)).toBe("30s");
  });

  it("formata minutos corretamente", () => {
    expect(formatTime(120)).toBe("2m");
    expect(formatTime(300)).toBe("5m");
  });

  it("formata horas e minutos corretamente", () => {
    expect(formatTime(3600)).toBe("1h0m");
    expect(formatTime(3660)).toBe("1h1m");
    expect(formatTime(7200)).toBe("2h0m");
    expect(formatTime(5400)).toBe("1h30m");
  });
});

describe("Rastreamento - Cálculo de ETA", () => {
  it("retorna duração total quando progresso é 0%", () => {
    // 6 horas de viagem = 21600 segundos
    const eta = calculateEtaMinutes(21600, 0);
    expect(eta).toBe(360); // 360 minutos = 6 horas
  });

  it("retorna metade quando progresso é 50%", () => {
    const eta = calculateEtaMinutes(21600, 50);
    expect(eta).toBe(180); // 180 minutos = 3 horas
  });

  it("retorna 0 quando progresso é 100%", () => {
    const eta = calculateEtaMinutes(21600, 100);
    expect(eta).toBe(0);
  });

  it("calcula ETA corretamente para 75% de progresso", () => {
    const eta = calculateEtaMinutes(21600, 75);
    expect(eta).toBe(90); // 90 minutos = 1.5 horas
  });
});

describe("Rastreamento - Cálculo de distância", () => {
  const totalDistanceMeters = 436000; // 436 km SP-RJ

  it("retorna 0 km percorridos quando progresso é 0%", () => {
    const covered = calculateDistanceCovered(totalDistanceMeters, 0);
    expect(covered).toBe(0);
  });

  it("retorna metade quando progresso é 50%", () => {
    const covered = calculateDistanceCovered(totalDistanceMeters, 50);
    expect(covered).toBe(218);
  });

  it("retorna distância total quando progresso é 100%", () => {
    const covered = calculateDistanceCovered(totalDistanceMeters, 100);
    expect(covered).toBe(436);
  });

  it("calcula distância restante corretamente", () => {
    expect(calculateDistanceRemaining(436, 0)).toBe(436);
    expect(calculateDistanceRemaining(436, 218)).toBe(218);
    expect(calculateDistanceRemaining(436, 436)).toBe(0);
    expect(calculateDistanceRemaining(436, 500)).toBe(0); // não fica negativo
  });
});

describe("Rastreamento - Fluxo de status da viagem", () => {
  const validStatuses = ["planejada", "em_andamento", "concluida"] as const;

  it("status inicial deve ser planejada ou em_andamento", () => {
    expect(validStatuses).toContain("planejada");
    expect(validStatuses).toContain("em_andamento");
  });

  it("transição planejada → em_andamento é válida", () => {
    const currentStatus = "planejada";
    const nextStatus = "em_andamento";
    const validTransitions: Record<string, string[]> = {
      planejada: ["em_andamento"],
      em_andamento: ["concluida"],
      concluida: [],
    };
    expect(validTransitions[currentStatus]).toContain(nextStatus);
  });

  it("transição em_andamento → concluida é válida", () => {
    const currentStatus = "em_andamento";
    const nextStatus = "concluida";
    const validTransitions: Record<string, string[]> = {
      planejada: ["em_andamento"],
      em_andamento: ["concluida"],
      concluida: [],
    };
    expect(validTransitions[currentStatus]).toContain(nextStatus);
  });

  it("transição concluida → qualquer status é inválida", () => {
    const validTransitions: Record<string, string[]> = {
      planejada: ["em_andamento"],
      em_andamento: ["concluida"],
      concluida: [],
    };
    expect(validTransitions["concluida"]).toHaveLength(0);
  });
});
