import type { Response } from "express";
import { uploadSemaphore } from "./concurrency";
import { trpcErrorBody } from "./trpcErrorBody";

// Slot de concorrência do upload, com ciclo de vida DESACOPLADO do socket. A
// barreira ADQUIRE o slot (proteção de leitura/parsing) e o instala aqui; a
// OPERAÇÃO PESADA (procedure documents.upload) o ASSUME (claimOperation) e o
// libera no seu try/finally — só quando R2 e banco terminam. Assim fechar o
// socket no meio NÃO abre um slot novo enquanto o trabalho anterior ainda roda.
export interface UploadSlot {
  // A operação pesada assumiu o slot — desarma a rede de segurança do socket e
  // o timeout de leitura. A partir daqui só o finally da operação libera.
  claimOperation(): void;
  // Libera o slot no semáforo (idempotente — exatamente uma vez).
  release(): void;
}

interface Destroyable {
  destroy(): void;
}

export interface UploadSlotDeps {
  bodyReadTimeoutMs?: number;
  // Injetável p/ teste; devolve um clear(). O timer real usa unref() p/ não
  // segurar o event loop sozinho.
  setTimer?: (fn: () => void, ms: number) => { clear: () => void };
}

// Se a operação NÃO assumir o slot dentro desta janela (corpo lento / slow-loris
// segurando o slot + a conexão), fail-closed: responde 408 (se ainda der) e
// encerra a leitura, liberando o slot pela rede de segurança.
export const UPLOAD_BODY_READ_TIMEOUT_MS = 30_000;

const SLOT = Symbol("uploadSlot");
type SlotLocals = { [SLOT]?: UploadSlot };
function bag(res: Response): SlotLocals {
  return res.locals as SlotLocals;
}

// Instala (em res.locals) o slot JÁ ADQUIRIDO pela barreira. Registra a rede de
// segurança e o timeout de leitura. Devolve o slot (também acessível via
// getUploadSlot no contexto tRPC).
export function installUploadSlot(
  req: Destroyable,
  res: Response,
  key: string,
  deps: UploadSlotDeps = {}
): UploadSlot {
  let released = false;
  let opStarted = false;
  const release = () => {
    if (!released) {
      released = true;
      uploadSemaphore.release(key);
    }
  };

  const timeoutMs = deps.bodyReadTimeoutMs ?? UPLOAD_BODY_READ_TIMEOUT_MS;
  const setTimer =
    deps.setTimer ??
    ((fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      t.unref();
      return { clear: () => clearTimeout(t) };
    });
  const timer = setTimer(() => {
    if (opStarted || released) return;
    if (!res.headersSent) {
      res
        .status(408)
        .json(
          trpcErrorBody(
            "TIMEOUT",
            408,
            "Leitura do upload excedeu o tempo limite."
          )
        );
    }
    req.destroy(); // encerra a leitura (slow-loris)
    release(); // fail-closed: libera JÁ, sem depender do 'close' do socket
  }, timeoutMs);

  const slot: UploadSlot = {
    claimOperation() {
      opStarted = true;
      timer.clear();
    },
    release,
  };

  // Rede de segurança: se a resposta terminar/fechar ANTES de a operação assumir
  // o slot (413, abort durante o parsing, timeout), libera. Se a operação já
  // assumiu, NÃO libera aqui — o finally da operação é o dono da liberação.
  const safetyNet = () => {
    timer.clear();
    if (!opStarted) release();
  };
  res.on("finish", safetyNet);
  res.on("close", safetyNet);
  bag(res)[SLOT] = slot;
  return slot;
}

export function getUploadSlot(res: Response): UploadSlot | undefined {
  // Fora do fluxo HTTP real (ex.: createCaller em teste) res.locals pode não
  // existir — devolve undefined (a procedure trata como no-op).
  const locals = res.locals as SlotLocals | undefined;
  return locals?.[SLOT];
}
