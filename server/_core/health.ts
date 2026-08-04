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
//   - SINGLE-FLIGHT: sondas simultâneas compartilham UMA execução (100 req → 1
//     SELECT 1) — não acumula consultas pendentes no pool;
//   - TIMEOUT sanitizado (o caller responde 503 sem detalhe interno).
// O cache + single-flight SÃO a proteção de taxa (não bloqueiam a sonda
// legítima). checkReady nunca lança → o estado é sempre boolean.
export function createReadiness(deps: ReadinessDeps): Readiness {
  const ttl = deps.cacheTtlMs ?? 1500;
  const timeoutMs = deps.timeoutMs ?? 5000;
  let cache: { ok: boolean; at: number } | null = null;
  let inFlight: Promise<boolean> | null = null;
  return {
    async check() {
      const t = deps.now();
      if (cache && t - cache.at < ttl) return cache.ok;
      if (inFlight) return inFlight; // single-flight: reusa a execução em curso
      inFlight = checkReady(deps.runQuery, timeoutMs).then(ok => {
        cache = { ok, at: deps.now() };
        inFlight = null;
        return ok;
      });
      return inFlight;
    },
  };
}
