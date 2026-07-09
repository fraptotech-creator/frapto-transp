// Regra PURA do odômetro: dado o estado de uma viagem, quantos km devem ser
// somados ao veículo. Só soma quando a viagem está CONCLUÍDA, ainda NÃO foi
// contabilizada, tem veículo e tem distância positiva. Caso contrário, 0.
//
// Mantendo a decisão pura (sem DB), o efeito de gravar fica fino na borda.

export type TripOdometerState = {
  status: string;
  distancia: string | number | null | undefined;
  quilometragemAplicada: boolean;
  veiculoId: number | null | undefined;
};

export function tripKmToAccrue(trip: TripOdometerState): number {
  if (trip.status !== "concluida") return 0;
  if (trip.quilometragemAplicada) return 0;
  if (!trip.veiculoId) return 0;
  const dist = Math.round(Number(trip.distancia ?? 0));
  if (!Number.isFinite(dist) || dist <= 0) return 0;
  return dist;
}
