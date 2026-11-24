// Resumo do trajeto de uma viagem e retenção de GPS — funções PURAS.
//
// Decisão do dono (24/11/2026): posições detalhadas de GPS com mais de 90 dias
// são apagadas, mas ANTES o trajeto vira um resumo de até ~100 pontos guardado
// em trip_trajeto_resumos — o desenho no mapa fica para sempre, ocupando quase
// nada. A velocidade de cada ponto é descartada; data/hora fica.

export const RETENCAO_GPS_DIAS = 90;
export const MAX_PONTOS_RESUMO = 100;

// [lat, lng, epochMs]
export type PontoResumo = [number, number, number];

export type PontoTrajeto = { lat: number; lng: number; t: number };

const DIA_MS = 24 * 60 * 60 * 1000;

export function corteRetencao(agora: Date, dias = RETENCAO_GPS_DIAS): Date {
  return new Date(agora.getTime() - dias * DIA_MS);
}

// Distância de P à reta AB num plano local (lng escalada por cos(lat)), em
// "graus de latitude" — só serve para COMPARAR, não precisa de metros exatos.
function distanciaAoSegmento(
  p: PontoTrajeto,
  a: PontoTrajeto,
  b: PontoTrajeto
): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lng * k;
  const bx = b.lng * k;
  const px = p.lng * k;
  const dx = bx - ax;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, p.lat - a.lat);
  const u = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (p.lat - a.lat) * dy) / len2)
  );
  return Math.hypot(px - (ax + u * dx), p.lat - (a.lat + u * dy));
}

// Ponto mais afastado do segmento [i, j] (exclusive).
function maisAfastado(pts: PontoTrajeto[], i: number, j: number) {
  let idx = -1;
  let dist = 0;
  for (let m = i + 1; m < j; m++) {
    const d = distanciaAoSegmento(pts[m], pts[i], pts[j]);
    if (d > dist) {
      dist = d;
      idx = m;
    }
  }
  return { idx, dist };
}

// ~1 metro em graus de latitude: abaixo disso o trecho já é reto o bastante.
const TOLERANCIA = 0.00001;

// Simplifica o trajeto para no máximo `max` pontos mantendo o FORMATO:
// Douglas-Peucker "top-N" — começa com início e fim e, a cada passo, inclui o
// ponto que mais se desvia da linha atual (a curva mais importante). Para
// quando chega a `max` pontos ou quando o resto já é praticamente reto.
// Início e fim são sempre mantidos; a ordem no tempo é preservada.
export function simplificarTrajeto(
  pontos: PontoTrajeto[],
  max = MAX_PONTOS_RESUMO
): PontoTrajeto[] {
  const pts = pontos.filter(
    p =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t)
  );
  if (pts.length <= 2 || pts.length <= max) return pts;
  const limite = Math.max(2, max);
  const manter = new Set<number>([0, pts.length - 1]);
  // Segmentos abertos, cada um com o seu ponto mais afastado.
  const abertos: { i: number; j: number; idx: number; dist: number }[] = [];
  const abrir = (i: number, j: number) => {
    const m = maisAfastado(pts, i, j);
    if (m.idx >= 0 && m.dist > TOLERANCIA) abertos.push({ i, j, ...m });
  };
  abrir(0, pts.length - 1);
  while (manter.size < limite && abertos.length > 0) {
    let melhor = 0;
    for (let s = 1; s < abertos.length; s++) {
      if (abertos[s].dist > abertos[melhor].dist) melhor = s;
    }
    const seg = abertos.splice(melhor, 1)[0];
    manter.add(seg.idx);
    abrir(seg.i, seg.idx);
    abrir(seg.idx, seg.j);
  }
  return Array.from(manter)
    .sort((a, b) => a - b)
    .map(i => pts[i]);
}

// Novo resumo = resumo já guardado (pontos mais antigos) + posições que vão ser
// apagadas agora, simplificados JUNTOS. Assim uma viagem que perde posições em
// mais de uma limpeza continua com o trajeto inteiro no resumo.
export function montarResumo(
  resumoAtual: PontoResumo[] | null | undefined,
  posicoesApagadas: PontoTrajeto[],
  max = MAX_PONTOS_RESUMO
): PontoResumo[] {
  const antigos: PontoTrajeto[] = (resumoAtual ?? []).map(([lat, lng, t]) => ({
    lat,
    lng,
    t,
  }));
  const todos = [...antigos, ...posicoesApagadas].sort((a, b) => a.t - b.t);
  return simplificarTrajeto(todos, max).map(p => [
    Math.round(p.lat * 1e7) / 1e7,
    Math.round(p.lng * 1e7) / 1e7,
    p.t,
  ]);
}

// Ponto no formato que o mapa (TripTracking) consome.
export type PontoMapa = {
  lat: string;
  lng: string;
  velocidade: string | null;
  capturedAt: Date;
};

// Trajeto para o mapa: resumo (trecho antigo, sem velocidade) seguido das
// posições detalhadas que ainda existem. Viagem antiga = só o resumo; viagem
// recente = só as posições; viagem que atravessou a limpeza = os dois juntos.
export function trajetoParaMapa(
  resumo: PontoResumo[] | null | undefined,
  detalhadas: PontoMapa[]
): PontoMapa[] {
  const doResumo: PontoMapa[] = (resumo ?? []).map(([lat, lng, t]) => ({
    lat: String(lat),
    lng: String(lng),
    velocidade: null,
    capturedAt: new Date(t),
  }));
  return [...doResumo, ...detalhadas];
}
