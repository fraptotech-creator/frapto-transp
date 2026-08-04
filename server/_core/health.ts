// Readiness: o banco está utilizável? Roda um SELECT 1 (somente leitura, NUNCA
// escreve) com timeout CURTO — se o banco está lento/fora, respondemos 503 e o
// Railway não manda tráfego para uma réplica que não serve. Diferente de
// liveness (/api/ping), que só diz "o processo está de pé".
//
// PURA quanto ao efeito: recebe o `runQuery` (injetável p/ teste) e o timeout.
// Nunca lança — devolve boolean (fail-closed: erro/timeout → não pronto).
export async function checkReady(
  runQuery: () => Promise<unknown>,
  timeoutMs: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">(resolve => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
    timer.unref?.();
  });
  try {
    const r = await Promise.race([
      runQuery().then(() => "ok" as const),
      timeout,
    ]);
    return r === "ok";
  } catch {
    // SELECT 1 falhou (conexão fora, credencial, etc.) → não pronto.
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ReadinessDeps {
  runQuery: () => Promise<unknown>;
  now: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export interface Readiness {
  check(): Promise<boolean>;
}

// Readiness RESISTENTE A CARGA para o probe do Railway:
//   - CACHE curto: um resultado recente serve o burst de sondas sem nova query;
//   - UMA query FÍSICA por vez: inFlight guarda a PRÓPRIA query, viva até
//     resolver/rejeitar (NÃO é limpa no timeout do race). Enquanto pendente,
//     toda sonda corre contra um timeout POR CHAMADA e responde 503 sem abrir
//     outra query — nem depois do TTL. Só quando a query física settla (resolve
//     ou rejeita) o cache é gravado e o slot liberado; a próxima sonda (após o
//     TTL) inicia uma nova. Assim, mesmo sem cancelamento no driver, há no
//     máximo UMA query física ativa.
//   - TIMEOUT sanitizado (o caller responde 503 sem detalhe interno).
export function createReadiness(deps: ReadinessDeps): Readiness {
  const ttl = deps.cacheTtlMs ?? 1500;
  const timeoutMs = deps.timeoutMs ?? 5000;
  let cache: { ok: boolean; at: number } | null = null;
  let inFlight: Promise<boolean> | null = null;

  const startPhysicalQuery = (): Promise<boolean> => {
    const p = deps
      .runQuery()
      .then(
        () => true,
        () => false
      )
      .then(ok => {
        cache = { ok, at: deps.now() };
        if (inFlight === p) inFlight = null; // só libera ao SETTLE de verdade
        return ok;
      });
    inFlight = p;
    return p;
  };

  return {
    async check() {
      const t = deps.now();
      if (cache && t - cache.at < ttl) return cache.ok;
      // No máximo UMA query física: reusa a pendente ou inicia uma.
      const q = inFlight ?? startPhysicalQuery();
      // Timeout POR CHAMADA: se a query ainda não settlou, responde 503 (false)
      // SEM abrir outra query e SEM soltar o inFlight (ela segue viva).
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<boolean>(resolve => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref?.();
      });
      try {
        return await Promise.race([q, timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
