// Limite de CONCORRÊNCIA (semáforo em memória) por chave + global. Usado para o
// assistente de IA: uma empresa não pode disparar N chamadas simultâneas (custo/
// esgotamento do pool), e o total global também tem teto. Em memória → vale por
// instância; com múltiplas réplicas, migrar para store compartilhado (deferido).

const emUso = new Map<string, number>();
let globalEmUso = 0;

// Tenta adquirir um slot. Retorna true se conseguiu (lembre de release depois),
// false se a chave OU o global já estão no teto. Fail-closed.
export function acquire(
  key: string,
  perKeyMax: number,
  globalMax: number
): boolean {
  const atual = emUso.get(key) ?? 0;
  if (atual >= perKeyMax || globalEmUso >= globalMax) return false;
  emUso.set(key, atual + 1);
  globalEmUso++;
  return true;
}

export function release(key: string): void {
  const atual = emUso.get(key) ?? 0;
  if (atual <= 1) emUso.delete(key);
  else emUso.set(key, atual - 1);
  if (globalEmUso > 0) globalEmUso--;
}

// Só para teste/observabilidade.
export function _snapshot() {
  return { global: globalEmUso, chaves: emUso.size };
}
