import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { assertSafeBaseUrl } from "../_core/urlSafety";
import { type AiRuntimeConfig, type AiProvider } from "../_core/llm";
import {
  getVehicleById,
  getDriverById,
  getTripById,
  getVehicles,
  getDrivers,
  getTrips,
  getMaintenances,
  getExpenses,
  getRevenues,
  getAiConfig,
} from "../db";
import { computeFinanceSummary } from "../_core/finance";
import { computeOilStatus } from "../_core/oil";

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

// Limites para não estourar tokens/custo em frotas grandes (lista o começo e
// avisa quantos ficaram de fora).
const CTX_MAX_VEHICLES = 60;
const CTX_MAX_TRIPS = 30;

export async function buildFleetContext(orgId: number): Promise<string> {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const [vehicles, drivers, trips, maintenances, expenses, revenues] =
    await Promise.all([
      getVehicles(orgId),
      getDrivers(orgId),
      getTrips(orgId),
      getMaintenances(orgId),
      getExpenses(orgId),
      getRevenues(orgId),
    ]);

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const brl = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const km = (n: number | null | undefined) =>
    `${(n ?? 0).toLocaleString("pt-BR")} km`;
  const driverName = (id: number | null | undefined) =>
    drivers.find(d => d.id === id)?.nome ?? "—";
  const truncNote = (total: number, shown: number) =>
    total > shown ? ` … e mais ${total - shown}.` : "";

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

  const fin = computeFinanceSummary({
    trips,
    maintenances,
    expenses,
    revenues,
  });

  const oilAlerts = vehicles
    .map(v => ({ v, oil: computeOilStatus(v) }))
    .filter(x => x.oil.status !== "ok");

  const lines: string[] = [];
  lines.push(`Data de hoje: ${new Date(now).toLocaleDateString("pt-BR")}.`);
  lines.push(
    `Frota: ${vehicles.length} veículos (ativos: ${fleetByStatus.ativo}, em manutenção: ${fleetByStatus.manutencao}, inativos: ${fleetByStatus.inativo}).`
  );

  // Lista de veículos (placa, modelo, status, km, situação do óleo).
  const vLines = vehicles.slice(0, CTX_MAX_VEHICLES).map(v => {
    const oil = computeOilStatus(v);
    const oilTxt =
      oil.status === "vencida"
        ? `óleo VENCIDO (${km(-oil.kmRestante)} atrás)`
        : oil.status === "proxima"
          ? `óleo a trocar em ${km(oil.kmRestante)}`
          : "óleo em dia";
    return `- ${v.placa} (${v.marca} ${v.modelo}) — ${v.status} — ${km(v.quilometragem)} — ${oilTxt}`;
  });
  lines.push(
    `Veículos:\n${vLines.join("\n")}${truncNote(vehicles.length, vLines.length)}`
  );

  lines.push(`Motoristas: ${drivers.length}.`);

  lines.push(
    `Viagens: ${trips.length} no total, ${viagensAtivas.length} ativas.`
  );
  if (viagensAtivas.length > 0) {
    const tLines = viagensAtivas.slice(0, CTX_MAX_TRIPS).map(t => {
      const veic = vehicles.find(v => v.id === t.veiculoId);
      return `- ${t.numeroViagem}: ${t.origem} → ${t.destino} — ${t.status} — motorista ${driverName(t.motoristaId)} — veículo ${veic?.placa ?? "?"}`;
    });
    lines.push(
      `Viagens ativas:\n${tLines.join("\n")}${truncNote(viagensAtivas.length, tLines.length)}`
    );
  }

  // Financeiro consolidado (mesmas regras da tela Financeiro).
  lines.push(
    `Financeiro (tudo, consolidado): Receitas ${brl(fin.receitas)}; A receber ${brl(fin.aReceber)}; Despesas ${brl(fin.despesas)}; Saldo ${brl(fin.saldo)}.`
  );

  lines.push(
    `Alertas de troca de óleo (${oilAlerts.length}): ` +
      (oilAlerts
        .map(
          ({ v, oil }) =>
            `${v.placa} (${oil.status === "vencida" ? `vencida, ${km(-oil.kmRestante)} atrás` : `faltam ${km(oil.kmRestante)}`})`
        )
        .join("; ") || "nenhum")
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

// Prompt do AGENTE (Groq/GPT): ele consulta o sistema via ferramentas.
export const AGENT_SYSTEM = `Você é o assistente de frota do sistema Frapto Transp.
Responda SEMPRE em português do Brasil, de forma objetiva.
Você tem FERRAMENTAS para consultar os dados REAIS da empresa deste usuário
(veículos, motoristas, viagens, manutenções e financeiro). Use as ferramentas
sempre que precisar de dados específicos — pode chamar mais de uma e cruzar as
informações antes de responder. Todas as ferramentas já são restritas à empresa
do usuário e são somente de leitura.
Regras: baseie-se SÓ nos dados retornados pelas ferramentas; nunca invente
números, nomes ou datas. Se algo não existir nos dados, diga que não há esse
registro. Valores em reais (R$) e datas no formato brasileiro.`;

const coerceProvider = (p: string): AiProvider =>
  p === "anthropic" || p === "openai" || p === "openai_compatible"
    ? p
    : "openai_compatible";

// Decisão PURA de qual IA usar (testável): 1º a config da EMPRESA (se ativa e
// com chave); 2º o PADRÃO do sistema (grátis, ex.: Groq); 3º o Anthropic legado.
export function pickAiConfig(
  orgCfg:
    | {
        provider: AiProvider;
        apiKey: string | null;
        model: string | null;
        baseUrl: string | null;
        enabled: boolean;
      }
    | null
    | undefined,
  defaults: {
    key: string;
    provider: string;
    model: string;
    baseUrl: string;
    anthropicKey: string;
  }
): AiRuntimeConfig | null {
  if (orgCfg && orgCfg.enabled && orgCfg.apiKey) {
    return {
      provider: orgCfg.provider,
      apiKey: orgCfg.apiKey,
      model: orgCfg.model ?? "",
      baseUrl: orgCfg.baseUrl,
    };
  }
  if (defaults.key) {
    return {
      provider: coerceProvider(defaults.provider),
      apiKey: defaults.key,
      model: defaults.model || "",
      baseUrl: defaults.baseUrl || null,
    };
  }
  if (defaults.anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: defaults.anthropicKey,
      model: "claude-haiku-4-5",
      baseUrl: null,
    };
  }
  return null;
}

// Resolve a IA da organização (busca a config no banco + aplica os padrões).
export async function resolveAiConfig(
  orgId: number
): Promise<AiRuntimeConfig | null> {
  const cfg = await getAiConfig(orgId);
  // Anti-SSRF: a Base URL custom (openai_compatible da EMPRESA) é revalidada a
  // CADA chamada, não só ao salvar — barra DNS-rebind para host interno/metadata.
  if (
    cfg?.enabled &&
    cfg.apiKey &&
    cfg.provider === "openai_compatible" &&
    cfg.baseUrl
  ) {
    try {
      await assertSafeBaseUrl(cfg.baseUrl);
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "A Base URL do provedor de IA é inválida ou insegura. Ajuste em Configurações.",
      });
    }
  }
  return pickAiConfig(cfg, {
    key: ENV.defaultAiKey,
    provider: ENV.defaultAiProvider,
    model: ENV.defaultAiModel,
    baseUrl: ENV.defaultAiBaseUrl,
    anthropicKey: ENV.anthropicApiKey,
  });
}
