// Rate-limit em memória (janela deslizante) para procedures tRPC — ex.: a IA,
// pra uma empresa não queimar a cota/custo do provedor. `now` entra por
// parâmetro pra ser testável. Ok p/ 1 instância; multi-instância exige store
// compartilhado (Redis) — ver plano.
const buckets = new Map<string, number[]>();

// Retorna true se PERMITIDO (e registra o hit); false se estourou o limite.
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): boolean {
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
}
