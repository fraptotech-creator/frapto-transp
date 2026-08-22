// Regras PURAS das notificações/alertas da frota (entram dados + settings, sai a
// lista de alertas). Sem DB, sem Date.now() interno — `agora` é parâmetro, então
// é 100% testável em 1ms. O efeito (carregar dados/settings) fica na borda
// (fleet.stats). Os limiares são configuráveis por empresa (notification_settings);
// os DEFAULTs reproduzem — e ampliam — o comportamento histórico.

import { computeOilStatus } from "./oil";

export interface NotificationSettings {
  cnhEnabled: boolean;
  cnhDiasAntes: number;
  crlvEnabled: boolean;
  crlvDiasAntes: number;
  manutencaoEnabled: boolean;
  manutencaoDiasAntes: number;
  oleoEnabled: boolean;
  oleoPercentAntes: number;
  documentosEnabled: boolean;
  documentosDiasAntes: number;
  // Escalonamento: alerta baseado em data com vencimento em ≤ este nº de dias
  // (ou já vencido) vira urgência "alta"; senão "media".
  urgenciaAltaDiasAntes: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  cnhEnabled: true,
  cnhDiasAntes: 30,
  crlvEnabled: true,
  crlvDiasAntes: 30,
  manutencaoEnabled: true,
  manutencaoDiasAntes: 7,
  oleoEnabled: true,
  oleoPercentAntes: 10,
  documentosEnabled: true,
  documentosDiasAntes: 30,
  urgenciaAltaDiasAntes: 7,
};

// Limites de validação — usados no zod do servidor E na UI (fonte única).
export const NOTIF_LIMITS = {
  diasMin: 1,
  diasMax: 365,
  oleoPercentMin: 1,
  oleoPercentMax: 50,
} as const;

export type Urgencia = "alta" | "media";

export interface Alerta {
  type: "manutencao" | "documento" | "cnh" | "oleo";
  title: string;
  message: string;
  urgency: Urgencia;
}

export interface VehicleLike {
  id: number;
  placa: string | null;
  crlvVencimento: Date | string | null;
  quilometragem?: number | null;
  kmUltimaTrocaOleo?: number | null;
  intervaloTrocaOleoKm?: number | null;
}
export interface DriverLike {
  id: number;
  nome: string | null;
  cnhVencimento: Date | string | null;
}
export interface MaintenanceLike {
  veiculoId: number | null;
  status: string | null;
  dataPrevista: Date | string | null;
}
export interface DocumentLike {
  tipo: string;
  descricao: string | null;
  veiculoId: number | null;
  motoristId: number | null;
  dataVencimento: Date | string | null;
}

export interface AlertData {
  vehicles: VehicleLike[];
  drivers: DriverLike[];
  maintenances: MaintenanceLike[];
  documents: DocumentLike[];
}

const DIA_MS = 24 * 60 * 60 * 1000;

function ts(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR");
}

// Urgência de um alerta baseado em DATA: "alta" se vence em ≤ urgenciaAltaDiasAntes
// (ou já venceu), senão "media".
function urgenciaPorData(
  vencMs: number,
  agoraMs: number,
  s: NotificationSettings
): Urgencia {
  return vencMs < agoraMs + s.urgenciaAltaDiasAntes * DIA_MS ? "alta" : "media";
}

// DECISÃO PURA. Ordem estável (manutenção → CRLV → CNH → óleo → documentos) e
// teto de 10 — igual ao histórico quando `documentos` está desligado.
export function buildAlerts(
  data: AlertData,
  settings: NotificationSettings,
  agora: Date
): Alerta[] {
  const agoraMs = agora.getTime();
  const alerts: Alerta[] = [];

  if (settings.manutencaoEnabled) {
    const limite = agoraMs + settings.manutencaoDiasAntes * DIA_MS;
    for (const m of data.maintenances) {
      const dv = ts(m.dataPrevista);
      if (m.status !== "pendente" || dv === null || dv >= limite) continue;
      const placa =
        data.vehicles.find(v => v.id === m.veiculoId)?.placa ?? "veículo";
      alerts.push({
        type: "manutencao",
        title: "Manutenção Próxima",
        message: `Veículo ${placa} tem manutenção agendada para ${fmt(m.dataPrevista!)}`,
        urgency: urgenciaPorData(dv, agoraMs, settings),
      });
    }
  }

  if (settings.crlvEnabled) {
    const limite = agoraMs + settings.crlvDiasAntes * DIA_MS;
    for (const v of data.vehicles) {
      const dv = ts(v.crlvVencimento);
      if (dv === null || dv >= limite) continue;
      alerts.push({
        type: "documento",
        title: "CRLV Vencendo",
        message: `O CRLV do veículo ${v.placa} vence em ${fmt(v.crlvVencimento!)}`,
        urgency: urgenciaPorData(dv, agoraMs, settings),
      });
    }
  }

  if (settings.cnhEnabled) {
    const limite = agoraMs + settings.cnhDiasAntes * DIA_MS;
    for (const d of data.drivers) {
      const dv = ts(d.cnhVencimento);
      if (dv === null || dv >= limite) continue;
      alerts.push({
        type: "cnh",
        title: "CNH Vencendo",
        message: `A CNH do motorista ${d.nome} vence em ${fmt(d.cnhVencimento!)}`,
        urgency: urgenciaPorData(dv, agoraMs, settings),
      });
    }
  }

  if (settings.oleoEnabled) {
    for (const v of data.vehicles) {
      const oil = computeOilStatus(v, settings.oleoPercentAntes);
      if (oil.status === "ok") continue;
      alerts.push({
        type: "oleo",
        title:
          oil.status === "vencida"
            ? "Troca de óleo vencida"
            : "Troca de óleo próxima",
        message:
          oil.status === "vencida"
            ? `Veículo ${v.placa} passou ${-oil.kmRestante} km do ponto de troca de óleo.`
            : `Veículo ${v.placa}: faltam ${oil.kmRestante} km para a troca de óleo.`,
        urgency: oil.status === "vencida" ? "alta" : "media",
      });
    }
  }

  if (settings.documentosEnabled) {
    const limite = agoraMs + settings.documentosDiasAntes * DIA_MS;
    for (const doc of data.documents) {
      const dv = ts(doc.dataVencimento);
      if (dv === null || dv >= limite) continue;
      const alvo =
        doc.veiculoId != null
          ? `veículo ${data.vehicles.find(v => v.id === doc.veiculoId)?.placa ?? "?"}`
          : doc.motoristId != null
            ? `motorista ${data.drivers.find(d => d.id === doc.motoristId)?.nome ?? "?"}`
            : null;
      const nome = doc.descricao?.trim() || doc.tipo.toUpperCase();
      alerts.push({
        type: "documento",
        title: "Documento Vencendo",
        message: `O documento ${nome}${alvo ? ` (${alvo})` : ""} vence em ${fmt(doc.dataVencimento!)}`,
        urgency: urgenciaPorData(dv, agoraMs, settings),
      });
    }
  }

  return alerts.slice(0, 10);
}
