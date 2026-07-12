// Ferramentas (function-calling) do assistente. Todas são SOMENTE LEITURA e
// escopadas por orgId (injetado pelo servidor — a IA nunca escolhe a empresa).
// A IA decide qual chamar; o servidor executa e devolve o dado para ela raciocinar.
import {
  getVehicles,
  getDrivers,
  getTrips,
  getMaintenances,
  getExpenses,
  getRevenues,
} from "../db";
import { computeFinanceSummary, computeFinanceLedger } from "./finance";
import { computeOilStatus } from "./oil";

type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  run: (orgId: number, args: Record<string, unknown>) => Promise<unknown>;
};

const oilTxt = (v: {
  quilometragem: number | null;
  kmUltimaTrocaOleo: number | null;
  intervaloTrocaOleoKm: number | null;
}): string => {
  const o = computeOilStatus(v);
  if (o.status === "vencida") return `vencida (${-o.kmRestante} km atrás)`;
  if (o.status === "proxima") return `faltam ${o.kmRestante} km`;
  return "em dia";
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const clampLimit = (v: unknown, def: number, max: number): number =>
  Math.min(Math.max(1, Number(v) || def), max);

export const AI_TOOLS: ToolDef[] = [
  {
    name: "listar_veiculos",
    description:
      "Lista os veículos da frota: placa, marca, modelo, status, km e situação do óleo.",
    parameters: { type: "object", properties: {} },
    run: async orgId => {
      const vs = await getVehicles(orgId);
      return vs.map(v => ({
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        status: v.status,
        km: v.quilometragem,
        oleo: oilTxt(v),
      }));
    },
  },
  {
    name: "listar_motoristas",
    description:
      "Lista os motoristas: nome, CNH, categoria, vencimento da CNH, status e telefone.",
    parameters: { type: "object", properties: {} },
    run: async orgId => {
      const ds = await getDrivers(orgId);
      return ds.map(d => ({
        nome: d.nome,
        cnh: d.cnh,
        categoria: d.cnhCategoria,
        vencimentoCnh: d.cnhVencimento,
        status: d.status,
        telefone: d.telefone,
      }));
    },
  },
  {
    name: "listar_viagens",
    description:
      "Lista viagens da mais recente para a mais antiga: número, origem, destino, status, datas, motorista, veículo e distância.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["planejada", "em_andamento", "concluida", "cancelada"],
          description: "filtra por status (opcional)",
        },
        limite: {
          type: "number",
          description: "máximo de viagens (padrão 20)",
        },
      },
    },
    run: async (orgId, args) => {
      const [ts, vs, ds] = await Promise.all([
        getTrips(orgId),
        getVehicles(orgId),
        getDrivers(orgId),
      ]);
      let list = [...ts].sort((a, b) => b.id - a.id); // id maior = mais recente
      const st = str(args.status);
      if (st) list = list.filter(t => t.status === st);
      return list.slice(0, clampLimit(args.limite, 20, 50)).map(t => ({
        numero: t.numeroViagem,
        origem: t.origem,
        destino: t.destino,
        status: t.status,
        dataPartida: t.dataPartida,
        previsaoChegada: t.previsaoChegada,
        dataChegada: t.dataChegada,
        motorista: ds.find(d => d.id === t.motoristaId)?.nome ?? null,
        veiculo: vs.find(v => v.id === t.veiculoId)?.placa ?? null,
        distanciaKm: t.distancia,
      }));
    },
  },
  {
    name: "listar_manutencoes",
    description:
      "Lista manutenções: veículo, tipo, status, data prevista, data realizada e custo.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pendente", "em_andamento", "concluida"],
        },
      },
    },
    run: async (orgId, args) => {
      const [ms, vs] = await Promise.all([
        getMaintenances(orgId),
        getVehicles(orgId),
      ]);
      const st = str(args.status);
      const list = st ? ms.filter(m => m.status === st) : ms;
      return list.map(m => ({
        veiculo: vs.find(v => v.id === m.veiculoId)?.placa ?? null,
        tipo: m.tipo,
        status: m.status,
        dataPrevista: m.dataPrevista,
        dataRealizada: m.dataRealizada,
        custo: m.custo,
      }));
    },
  },
  {
    name: "resumo_financeiro",
    description:
      "Resumo financeiro consolidado: receitas (viagens concluídas + receitas recebidas), a receber, despesas (manutenção concluída + despesas manuais) e saldo.",
    parameters: { type: "object", properties: {} },
    run: async orgId => {
      const [trips, maintenances, expenses, revenues] = await Promise.all([
        getTrips(orgId),
        getMaintenances(orgId),
        getExpenses(orgId),
        getRevenues(orgId),
      ]);
      return computeFinanceSummary({ trips, maintenances, expenses, revenues });
    },
  },
  {
    name: "extrato_financeiro",
    description:
      "Extrato itemizado (cada receita/despesa): origem, categoria, descrição, data, valor e status. Da mais recente para a mais antiga.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"] },
        limite: { type: "number", description: "máximo de itens (padrão 30)" },
      },
    },
    run: async (orgId, args) => {
      const [trips, maintenances, expenses, revenues] = await Promise.all([
        getTrips(orgId),
        getMaintenances(orgId),
        getExpenses(orgId),
        getRevenues(orgId),
      ]);
      let led = computeFinanceLedger({
        trips,
        maintenances,
        expenses,
        revenues,
      });
      const tipo = str(args.tipo);
      if (tipo) led = led.filter(e => e.kind === tipo);
      return led.slice(0, clampLimit(args.limite, 30, 60));
    },
  },
];

// Definições no formato de "tools" da API OpenAI (usada por Groq/GPT/compatível).
export function toOpenAiTools() {
  return AI_TOOLS.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Executa uma ferramenta pedida pela IA. Nunca lança — devolve JSON (com teto de
// tamanho). orgId vem do servidor; name/args vêm da IA.
export async function runAiTool(
  orgId: number,
  name: string,
  argsJson: string
): Promise<string> {
  const tool = AI_TOOLS.find(t => t.name === name);
  if (!tool)
    return JSON.stringify({ erro: `ferramenta desconhecida: ${name}` });
  let args: Record<string, unknown> = {};
  try {
    const parsed = argsJson ? JSON.parse(argsJson) : {};
    if (parsed && typeof parsed === "object") args = parsed;
  } catch {
    args = {};
  }
  try {
    const out = JSON.stringify(await tool.run(orgId, args));
    return out.length > 12000 ? out.slice(0, 12000) + "…(truncado)" : out;
  } catch (e) {
    return JSON.stringify({
      erro: e instanceof Error ? e.message : "falha na ferramenta",
    });
  }
}
