// Data de realização ao CONCLUIR uma manutenção. Decisão PURA.
//
// O financeiro e os relatórios datam o custo da manutenção por
// `dataRealizada || dataPrevista`. A tela exige a data ao concluir, mas o
// servidor aceitava concluir sem ela — e o custo caía no mês PREVISTO, não no
// mês em que o serviço foi feito (auditoria pré-venda 23/11/2026).
// Regra: concluindo sem data informada e sem data já gravada → o dia de HOJE no
// horário de Brasília, gravado à meia-noite UTC (mesmo formato das datas-só-dia
// do sistema; às 22h de Brasília já é "amanhã" em UTC). Senão, não mexe.
export function dataRealizadaAoConcluir(
  novoStatus: string | undefined,
  informada: Date | undefined,
  gravada: Date | string | null | undefined,
  agora: Date
): Date | undefined {
  if (novoStatus !== "concluida" || informada || gravada) return undefined;
  // "en-CA" formata como AAAA-MM-DD.
  const dia = agora.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(`${dia}T00:00:00.000Z`);
}
