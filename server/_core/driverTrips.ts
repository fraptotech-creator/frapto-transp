// Decisão PURA de quais viagens o MOTORISTA enxerga no app dele: só as que
// ele ainda precisa tocar — planejada (pra iniciar) e em_andamento (pra
// concluir). Concluída/cancelada somem da visão do motorista.
const STATUS_VISIVEIS = new Set(["planejada", "em_andamento"]);

export function visivelParaMotorista(trip: { status: string }): boolean {
  return STATUS_VISIVEIS.has(trip.status);
}
