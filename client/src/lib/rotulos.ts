// Rótulo de tela para os valores internos (enums do banco), com acento.
// Antes a tela capitalizava o valor cru: "Caminhao", "Concluida",
// "Em_andamento", "Combustivel" (teste pré-venda 23/11/2026).
const ROTULOS: Record<string, string> = {
  // tipo de veículo
  caminhao: "Caminhão",
  van: "Van",
  onibus: "Ônibus",
  carro: "Carro",
  // status de veículo / motorista
  ativo: "Ativo",
  manutencao: "Manutenção",
  inativo: "Inativo",
  disponivel: "Disponível",
  viagem: "Viagem",
  descansando: "Descansando",
  // status de viagem / manutenção
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
  pendente: "Pendente",
  // financeiro
  combustivel: "Combustível",
  pedagio: "Pedágio",
  seguro: "Seguro",
  salario: "Salário",
  outros: "Outros",
  frete: "Frete",
  servico: "Serviço",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

// Valor desconhecido: devolve capitalizado e sem "_" (nunca some da tela).
export function rotulo(valor: string | null | undefined): string {
  if (!valor) return "";
  const r = ROTULOS[valor];
  if (r) return r;
  const limpo = valor.replace(/_/g, " ");
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}
