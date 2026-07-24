// Máquina de estados PURA da viagem. Sem isto, qualquer update podia gravar
// qualquer status: reabrir uma viagem concluída (concluida→em_andamento),
// pular etapas (planejada→concluida) ou ressuscitar uma cancelada. Além de
// dado inconsistente, "concluir" dispara efeito (soma ao odômetro), então
// pulos/reversões bagunçam o histórico do veículo.
//
// A decisão é pura e testável; a borda (router) carrega o status atual e só
// grava se a transição for válida — fail-closed.

export type TripStatus =
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "cancelada";

// De cada estado, para quais estados é lícito ir. Concluída e cancelada são
// TERMINAIS (lista vazia): nada sai delas.
const TRANSICOES: Record<TripStatus, readonly TripStatus[]> = {
  planejada: ["em_andamento", "cancelada"],
  em_andamento: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

// Permite a transição de/para. Same-state (de === para) é no-op idempotente:
// editar outros campos reenviando o status atual não pode falhar.
export function transicaoValida(de: TripStatus, para: TripStatus): boolean {
  if (de === para) return true;
  return TRANSICOES[de].includes(para);
}

// Estado do qual não se sai mais (para mensagens/UX e checagens rápidas).
export function estadoTerminal(status: TripStatus): boolean {
  return TRANSICOES[status].length === 0;
}
