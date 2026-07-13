// Filtro PURO de viagens por status (usado na aba Viagens). "todas" não filtra.
export type TripStatusFilter =
  | "todas"
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export function filtrarPorStatus<T extends { status: string }>(
  trips: T[],
  status: TripStatusFilter
): T[] {
  if (status === "todas") return trips;
  return trips.filter(t => t.status === status);
}
