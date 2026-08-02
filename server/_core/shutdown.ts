import type { Server } from "node:http";

export interface ShutdownDeps {
  log?: (m: string) => void;
  exit?: (code: number) => void;
  // Timer de segurança (injetável p/ teste). Deve devolver algo com unref()
  // para não segurar o event loop sozinho.
  setTimer?: (fn: () => void, ms: number) => { unref: () => void };
  timeoutMs?: number;
}

// Handler IDEMPOTENTE de encerramento gracioso: para de aceitar conexões novas
// (server.close), deixa as em andamento drenarem e sai com 0. Um timer de
// segurança força a saída (1) se o close travar — o Railway envia SIGTERM no
// redeploy e não pode ficar preso por uma conexão pendurada. Devolve o handler
// para teste direto.
export function createShutdownHandler(
  server: Pick<Server, "close">,
  deps: ShutdownDeps = {}
): () => void {
  const log = deps.log ?? ((m: string) => console.log(m));
  const exit = deps.exit ?? ((c: number) => process.exit(c));
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const setTimer =
    deps.setTimer ??
    ((fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      t.unref();
      return { unref: () => t.unref() };
    });

  let disparado = false;
  return () => {
    if (disparado) return; // ignora sinais repetidos
    disparado = true;
    log("[Shutdown] sinal recebido — encerrando graciosamente");
    setTimer(() => {
      log("[Shutdown] timeout ao drenar conexões — forçando saída");
      exit(1);
    }, timeoutMs);
    server.close(() => {
      log("[Shutdown] servidor encerrado");
      exit(0);
    });
  };
}

// Registra o handler em SIGTERM e SIGINT.
export function installGracefulShutdown(
  server: Pick<Server, "close">,
  deps: ShutdownDeps = {}
): void {
  const handler = createShutdownHandler(server, deps);
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
}
