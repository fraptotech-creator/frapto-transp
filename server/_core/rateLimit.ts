// Rate-limit em memória (janela deslizante) para procedures tRPC — ex.: a IA,
// pra uma empresa não queimar a cota/custo do provedor. `now` entra por
// parâmetro pra ser testável. Ok p/ 1 instância; multi-instância exige store
// compartilhado (Redis) — ver plano.
const buckets = new Map<string, number[]>();

// Sweep periódico: sem isto, cada IP/conta/org deixava uma entrada PERMANENTE no
// Map (vazamento de memória). A cada intervalo, remove chaves sem hit recente.
// STALE cobre com folga a maior janela usada (login = 15 min).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const cutoff = now - STALE_MS;
  for (const key of Array.from(buckets.keys())) {
    const hits = buckets.get(key) ?? [];
    if (!hits.some(t => t > cutoff)) buckets.delete(key);
  }
}

// Retorna true se PERMITIDO (e registra o hit); false se estourou o limite.
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): boolean {
  sweep(now);
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter(t => t > cutoff);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

// Só para testes: limpa o estado.
export function _resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}
