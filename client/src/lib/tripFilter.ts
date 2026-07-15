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

// Combina os filtros de MÊS (YYYY-MM) e DATA (YYYY-MM-DD) sobre a data local da
// viagem (ymd = "YYYY-MM-DD"). Vazio = não filtra. Puro/determinístico (recebe
// a data já em string local, sem depender de fuso).
export function combinaDataFiltro(
  ymd: string,
  mes: string,
  data: string
): boolean {
  if (data && ymd !== data) return false;
  if (mes && ymd.slice(0, 7) !== mes) return false;
  return true;
}
