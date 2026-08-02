// Limite de CONCORRÊNCIA (semáforo em memória) por chave + global. Em memória →
// vale por instância; com múltiplas réplicas, migrar para store compartilhado
// (deferido). Cada POOL tem seu próprio teto global INDEPENDENTE — assim o
// upload de documentos e o assistente de IA não competem pelo mesmo teto (antes
// compartilhavam um único contador global: um upload consumia o orçamento da IA
// e vice-versa).

export interface Semaphore {
  // Tenta adquirir um slot. true se conseguiu (lembre de release depois); false
  // se a chave OU o global já estão no teto. Fail-closed.
  acquire(key: string, perKeyMax: number, globalMax: number): boolean;
  release(key: string): void;
  // Observabilidade/teste.
  snapshot(): { global: number; chaves: number };
  // Só para testes: zera o estado entre casos.
  reset(): void;
}

export function createSemaphore(): Semaphore {
  const emUso = new Map<string, number>();
  let globalEmUso = 0;
  return {
    acquire(key, perKeyMax, globalMax) {
      const atual = emUso.get(key) ?? 0;
      if (atual >= perKeyMax || globalEmUso >= globalMax) return false;
      emUso.set(key, atual + 1);
      globalEmUso++;
      return true;
    },
    release(key) {
      const atual = emUso.get(key) ?? 0;
      if (atual <= 1) emUso.delete(key);
      else emUso.set(key, atual - 1);
      if (globalEmUso > 0) globalEmUso--;
    },
    snapshot() {
      return { global: globalEmUso, chaves: emUso.size };
    },
    reset() {
      emUso.clear();
      globalEmUso = 0;
    },
  };
}

// Pools INDEPENDENTES (teto global separado): o upload (rota cara, ~13 MB) não
// disputa o mesmo teto do assistente de IA.
export const uploadSemaphore = createSemaphore();
export const aiSemaphore = createSemaphore();
