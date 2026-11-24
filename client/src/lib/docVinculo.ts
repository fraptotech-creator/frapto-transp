import { formatPlaca } from "./format";

// Vínculo de um documento (PURO): a quem ele pertence, para mostrar na lista
// e entrar na busca. Antes a tela não deixava vincular — o CRLV de qual
// veículo? a CNH de qual motorista? (teste pré-venda 23/11/2026). O servidor e
// o alerta de vencimento (notifications.ts) já usavam veiculoId/motoristId.
type Doc = { veiculoId?: number | null; motoristId?: number | null };
type Veiculo = { id: number; placa: string };
type Motorista = { id: number; nome: string };

export function vinculoDocumento(
  doc: Doc,
  veiculos: readonly Veiculo[],
  motoristas: readonly Motorista[]
): string {
  const partes: string[] = [];
  if (doc.veiculoId != null) {
    const v = veiculos.find(x => x.id === doc.veiculoId);
    partes.push(v ? formatPlaca(v.placa) : "Veículo removido");
  }
  if (doc.motoristId != null) {
    const m = motoristas.find(x => x.id === doc.motoristId);
    partes.push(m ? m.nome : "Motorista removido");
  }
  return partes.join(" · ");
}
