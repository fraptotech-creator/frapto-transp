import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { type AiRuntimeConfig } from "../_core/llm";
import {
  getVehicleById,
  getDriverById,
  getTripById,
  getVehicles,
  getDrivers,
  getTrips,
  getMaintenances,
  getAiConfig,
} from "../db";

export const parseNumericString = (
  value: string | null | undefined
): string | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : String(parsed);
};

// Campos numéricos OBRIGATÓRIOS (notNull no schema). Falha fechado: entrada
// não-numérica vira erro de validação, em vez de null que estouraria no banco.
export const parseRequiredNumericString = (value: string): string => {
  const parsed = parseNumericString(value);
  if (parsed === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Valor numérico inválido.",
    });
  }
  return parsed;
};

// Valida que os IDs referenciados pertencem à MESMA org — impede referência
// órfã a veículo/motorista/viagem de outra empresa (defesa explícita de tenant).
export async function assertRefsOwned(
  orgId: number,
  refs: {
    veiculoId?: number | null;
    motoristaId?: number | null;
    viagemId?: number | null;
  }
) {
  if (
    refs.veiculoId != null &&
    !(await getVehicleById(orgId, refs.veiculoId))
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Veículo inválido." });
  }
  if (
    refs.motoristaId != null &&
    !(await getDriverById(orgId, refs.motoristaId))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Motorista inválido.",
    });
  }
  if (refs.viagemId != null && !(await getTripById(orgId, refs.viagemId))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Viagem inválida." });
  }
}

// Higiene do input do chat (prompt-injection): remove caracteres de controle
// (preserva tab/quebra de linha) e limita o tamanho.
export function sanitizeChatContent(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 32 || c === 9 || c === 10 || c === 13) out += ch;
  }
  return out.slice(0, 4000);
}

export async function buildFleetContext(orgId: number): Promise<string> {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const [vehicles, drivers, trips, maintenances] = await Promise.all([
    getVehicles(orgId),
    getDrivers(orgId),
    getTrips(orgId),
    getMaintenances(orgId),
  ]);

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const fleetByStatus = {
    ativo: vehicles.filter(v => v.status === "ativo").length,
    manutencao: vehicles.filter(v => v.status === "manutencao").length,
    inativo: vehicles.filter(v => v.status === "inativo").length,
  };

  const cnhVencendo = drivers.filter(
    d => d.cnhVencimento && new Date(d.cnhVencimento).getTime() < in30Days
  );
  const crlvVencendo = vehicles.filter(
    v => v.crlvVencimento && new Date(v.crlvVencimento).getTime() < in30Days
  );
  const viagensAtivas = trips.filter(
    t => t.status === "em_andamento" || t.status === "planejada"
  );
  const manutencoesPendentes = maintenances.filter(
    m => m.status === "pendente" || m.status === "em_andamento"
  );

  const lines: string[] = [];
  lines.push(`Data de hoje: ${new Date(now).toLocaleDateString("pt-BR")}.`);
  lines.push(
    `Frota: ${vehicles.length} veículos (ativos: ${fleetByStatus.ativo}, em manutenção: ${fleetByStatus.manutencao}, inativos: ${fleetByStatus.inativo}).`
  );
  lines.push(`Motoristas: ${drivers.length}.`);
  lines.push(
    `Viagens: ${trips.length} no total, ${viagensAtivas.length} ativas (planejada/em andamento).`
  );
  lines.push(
    `CNHs vencendo em até 30 dias (${cnhVencendo.length}): ` +
      (cnhVencendo.map(d => `${d.nome} (${fmt(d.cnhVencimento)})`).join("; ") ||
        "nenhuma")
  );
  lines.push(
    `CRLVs vencendo em até 30 dias (${crlvVencendo.length}): ` +
      (crlvVencendo
        .map(v => `${v.placa} (${fmt(v.crlvVencimento)})`)
        .join("; ") || "nenhum")
  );
  lines.push(
    `Manutenções pendentes (${manutencoesPendentes.length}): ` +
      (manutencoesPendentes
        .map(m => {
          const veic = vehicles.find(v => v.id === m.veiculoId);
          return `${veic?.placa ?? "?"} - ${m.tipo} (prevista ${fmt(m.dataPrevista)})`;
        })
        .join("; ") || "nenhuma")
  );
  return lines.join("\n");
}

export const FLEET_ASSISTANT_SYSTEM = `Você é o assistente de frota do sistema Frapto Transp.
Responda em português do Brasil, de forma objetiva e útil, sobre gestão de frota:
veículos, motoristas, viagens, manutenções, documentos (CNH/CRLV) e finanças.
Baseie-se SOMENTE nos dados de contexto fornecidos abaixo. Se a informação não
estiver no contexto, diga que não tem esse dado — nunca invente números.

DADOS ATUAIS DA FROTA:
`;

// Config de IA da organização; fallback pro ANTHROPIC_API_KEY do ambiente.
export async function resolveAiConfig(
  orgId: number
): Promise<AiRuntimeConfig | null> {
  const cfg = await getAiConfig(orgId);
  if (cfg && cfg.enabled && cfg.apiKey) {
    return {
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model ?? "",
      baseUrl: cfg.baseUrl,
    };
  }
  if (ENV.anthropicApiKey) {
    return {
      provider: "anthropic",
      apiKey: ENV.anthropicApiKey,
      model: "claude-haiku-4-5",
      baseUrl: null,
    };
  }
  return null;
}
