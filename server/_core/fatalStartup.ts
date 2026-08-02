import { toSafeLogError } from "./safeLog";

// Falha FATAL de inicialização deve encerrar o processo com status != 0, para o
// Railway detectar (restart policy / alerta) em vez de encerrar com 0 e mascarar
// o problema. Usa process.exitCode (NÃO process.exit) para não cortar o flush
// dos logs — o processo termina naturalmente quando o event loop drena (o listen
// não chegou a segurar o loop, pois o guard roda antes).
//
// DIAGNÓSTICO suficiente, SEM vazar segredo: loga a mensagem (o guard de boot
// produz texto acionável e sem valores — nomes dos problemas + no máximo o valor
// de NODE_ENV, que não é segredo) MAIS a identidade curada do erro
// (name/code/errno via allowlist do toSafeLogError). NUNCA loga stack/cause crus
// (poderiam trazer SQL/PII/credenciais). Assim um erro inesperado no boot (não só
// o do guard) deixa rastro para diagnóstico, sem risco de vazamento.
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
  const safe = toSafeLogError(err);
  const id = [safe.name, safe.code, safe.errno].filter(Boolean).join(" ");
  log(`[Boot] Falha fatal na inicialização [${id}]:\n${msg}`);
  setExitCode(1);
}
