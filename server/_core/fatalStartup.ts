// Falha FATAL de inicialização deve encerrar o processo com status != 0, para o
// Railway detectar (restart policy / alerta) em vez de encerrar com 0 e mascarar
// o problema. Usa process.exitCode (NÃO process.exit) para não cortar o flush
// dos logs — o processo termina naturalmente quando o event loop drena (o listen
// não chegou a segurar o loop, pois o guard roda antes).
//
// Loga SOMENTE a mensagem: o guard de boot produz texto acionável e SEM valores
// de segredo (nomes dos problemas + no máximo o valor de NODE_ENV, que não é
// segredo). NUNCA loga stack/cause (poderiam trazer mais que a mensagem curada).
export function reportFatalStartup(
  err: unknown,
  deps: {
    log?: (m: string) => void;
    setExitCode?: (c: number) => void;
  } = {}
): void {
  const log = deps.log ?? ((m: string) => console.error(m));
  const setExitCode =
    deps.setExitCode ??
    ((c: number) => {
      process.exitCode = c;
    });
  const msg = err instanceof Error ? err.message : String(err);
  log(`[Boot] Falha fatal na inicialização:\n${msg}`);
  setExitCode(1);
}
