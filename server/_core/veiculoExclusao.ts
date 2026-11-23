// Pode excluir este veículo? Decisão PURA (testável); a contagem vem do banco.
//
// Excluir um veículo que tem histórico deixava viagens, manutenções, despesas
// e documentos apontando para um id que não existe mais — e esses registros
// seguiam somando no financeiro sem veículo (teste pré-venda 23/11/2026).
// Decisão do dono: BLOQUEAR. Para tirar de uso, o caminho é o status Inativo,
// que preserva o histórico.
export type HistoricoVeiculo = {
  viagens: number;
  manutencoes: number;
  despesas: number;
  documentos: number;
};

export type DecisaoExclusaoVeiculo =
  | { ok: true }
  | { ok: false; mensagem: string };

function plural(n: number, singular: string, pluralForma: string) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

export function decidirExclusaoVeiculo(
  h: HistoricoVeiculo
): DecisaoExclusaoVeiculo {
  const partes: string[] = [];
  if (h.viagens > 0) partes.push(plural(h.viagens, "viagem", "viagens"));
  if (h.manutencoes > 0)
    partes.push(plural(h.manutencoes, "manutenção", "manutenções"));
  if (h.despesas > 0) partes.push(plural(h.despesas, "despesa", "despesas"));
  if (h.documentos > 0)
    partes.push(plural(h.documentos, "documento", "documentos"));

  if (partes.length === 0) return { ok: true };

  const lista =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return {
    ok: false,
    mensagem:
      `Este veículo não pode ser excluído porque tem ${lista} registrados. ` +
      `Para tirá-lo de uso sem perder o histórico, edite o veículo e mude o status para Inativo.`,
  };
}
