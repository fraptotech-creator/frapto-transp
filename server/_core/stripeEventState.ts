// Decisões PURAS do lifecycle do webhook Stripe. Testáveis sem banco.

// Duplicata de chave: o Drizzle EMBRULHA o erro do driver (DrizzleQueryError)
// e o `code`/`errno` do MySQL fica em `cause` (às vezes aninhado). Checar só o
// topo (error.code) deixava a duplicata passar. Percorre TODA a cadeia de cause.
export function isDupError(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    const o = cur as { code?: unknown; errno?: unknown; cause?: unknown };
    if (o.code === "ER_DUP_ENTRY" || o.errno === 1062) return true;
    cur = o.cause;
  }
  return false;
}

export type EventoRow = {
  status: "processing" | "processed" | "failed";
  updatedAt: Date | string | null | undefined;
};

// Um evento já registrado PODE ser reivindicado (reprocessado) se falhou, ou se
// está 'processing' há mais que staleMs (worker anterior morreu no meio). Já
// 'processed' nunca; 'processing' recente = outro worker ativo → não reivindica.
export function podeReivindicar(
  row: EventoRow,
  now: Date,
  staleMs: number
): boolean {
  if (row.status === "processed") return false;
  if (row.status === "failed") return true;
  // processing: só se estiver velho (abandonado).
  const t = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  return now.getTime() - t >= staleMs;
}
