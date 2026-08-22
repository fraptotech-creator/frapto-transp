// Disponibilidade EFETIVA do motorista (regra pura, testável). Corrige o bug de
// mostrar "Disponível" com a CNH vencida: a CNH vencida MANDA — motorista sem
// habilitação válida não pode dirigir, independente do status/flag manual.
//
// Ordem de decisão (fail-closed):
//   1. CNH vencida            → Indisponível (motivo "CNH vencida").
//   2. flag manual desligada  → Indisponível (o gestor marcou no cadastro).
//   3. status operacional     → Em viagem / Descansando / Inativo.
//   4. senão                  → Disponível.

export type ChaveCorDisponibilidade =
  | "disponivel"
  | "viagem"
  | "descansando"
  | "inativo"
  | "indisponivel";

export interface DriverDisponibilidadeInput {
  status: string;
  disponibilidade: boolean;
  cnhVencimento: Date | string | null;
}

export interface DisponibilidadeResultado {
  disponivel: boolean;
  rotulo: string;
  chaveCor: ChaveCorDisponibilidade;
  motivo: string | null;
}

export function cnhVencida(
  cnhVencimento: Date | string | null | undefined,
  agora: Date
): boolean {
  if (!cnhVencimento) return false;
  const t = new Date(cnhVencimento).getTime();
  return Number.isFinite(t) && t < agora.getTime();
}

export function resolverDisponibilidade(
  d: DriverDisponibilidadeInput,
  agora: Date
): DisponibilidadeResultado {
  if (cnhVencida(d.cnhVencimento, agora)) {
    return {
      disponivel: false,
      rotulo: "Indisponível",
      chaveCor: "indisponivel",
      motivo: "CNH vencida",
    };
  }
  if (!d.disponibilidade) {
    return {
      disponivel: false,
      rotulo: "Indisponível",
      chaveCor: "indisponivel",
      motivo: null,
    };
  }
  switch (d.status) {
    case "viagem":
      return {
        disponivel: false,
        rotulo: "Em viagem",
        chaveCor: "viagem",
        motivo: null,
      };
    case "descansando":
      return {
        disponivel: false,
        rotulo: "Descansando",
        chaveCor: "descansando",
        motivo: null,
      };
    case "inativo":
      return {
        disponivel: false,
        rotulo: "Inativo",
        chaveCor: "inativo",
        motivo: null,
      };
    default:
      return {
        disponivel: true,
        rotulo: "Disponível",
        chaveCor: "disponivel",
        motivo: null,
      };
  }
}
