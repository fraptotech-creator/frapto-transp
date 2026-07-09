// Regras PURAS da troca de óleo por quilometragem.
// - isOilChange: reconhece uma manutenção de óleo pelo texto do tipo.
// - computeOilStatus: dado odômetro + última troca + intervalo, diz quanto
//   falta e o estado (ok / próxima / vencida). Sem DB, testável em 1ms.

const INTERVALO_PADRAO = 10000;

// Normaliza acentos e caixa: "Troca de Óleo" → "troca de oleo".
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function isOilChange(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  return semAcento(tipo).includes("oleo");
}

export type OilInput = {
  quilometragem: number | null | undefined;
  kmUltimaTrocaOleo: number | null | undefined;
  intervaloTrocaOleoKm: number | null | undefined;
};

export type OilStatus = {
  intervalo: number;
  kmDesdeTroca: number;
  proximaTrocaKm: number;
  kmRestante: number; // negativo = passou do ponto
  status: "ok" | "proxima" | "vencida";
};

export function computeOilStatus(v: OilInput): OilStatus {
  const intervalo =
    v.intervaloTrocaOleoKm && v.intervaloTrocaOleoKm > 0
      ? v.intervaloTrocaOleoKm
      : INTERVALO_PADRAO;
  const km = v.quilometragem ?? 0;
  const ultima = v.kmUltimaTrocaOleo ?? 0;
  const kmDesdeTroca = Math.max(0, km - ultima);
  const proximaTrocaKm = ultima + intervalo;
  const kmRestante = proximaTrocaKm - km;
  // Alerta quando falta ≤ 10% do intervalo (mínimo 1 km).
  const limiteAlerta = Math.max(1, Math.round(intervalo * 0.1));
  const status =
    kmRestante <= 0 ? "vencida" : kmRestante <= limiteAlerta ? "proxima" : "ok";
  return { intervalo, kmDesdeTroca, proximaTrocaKm, kmRestante, status };
}
