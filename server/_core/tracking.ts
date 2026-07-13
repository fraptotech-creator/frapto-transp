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

// Velocidade do navegador vem em m/s (pode ser null). Converte p/ km/h.
export function speedMsToKmh(speed: number | null | undefined): number | null {
  if (speed == null || Number.isNaN(speed) || speed < 0) return null;
  return Math.round(speed * 3.6 * 100) / 100;
}
