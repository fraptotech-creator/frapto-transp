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
