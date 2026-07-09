// Espelho (client) da regra pura de troca de óleo do servidor (server/_core/oil.ts).
// Usado só para EXIBIR status/alertas; a fonte da verdade continua no backend.

export type OilStatus = {
  intervalo: number;
  kmDesdeTroca: number;
  proximaTrocaKm: number;
  kmRestante: number;
  status: "ok" | "proxima" | "vencida";
};

export function computeOilStatus(v: {
  quilometragem?: number | null;
  kmUltimaTrocaOleo?: number | null;
  intervaloTrocaOleoKm?: number | null;
}): OilStatus {
  const intervalo =
    v.intervaloTrocaOleoKm && v.intervaloTrocaOleoKm > 0
      ? v.intervaloTrocaOleoKm
      : 10000;
  const km = v.quilometragem ?? 0;
  const ultima = v.kmUltimaTrocaOleo ?? 0;
  const kmDesdeTroca = Math.max(0, km - ultima);
  const proximaTrocaKm = ultima + intervalo;
  const kmRestante = proximaTrocaKm - km;
  const limiteAlerta = Math.max(1, Math.round(intervalo * 0.1));
  const status =
    kmRestante <= 0 ? "vencida" : kmRestante <= limiteAlerta ? "proxima" : "ok";
  return { intervalo, kmDesdeTroca, proximaTrocaKm, kmRestante, status };
}

export const OIL_LABEL: Record<OilStatus["status"], string> = {
  ok: "Em dia",
  proxima: "Troca próxima",
  vencida: "Troca vencida",
};
