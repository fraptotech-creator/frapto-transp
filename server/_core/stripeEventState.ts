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

// FENCING: só o dono da geração ATUAL pode fechar a transição. A marca de
// processed/failed exige status ainda 'processing' E o mesmo `attempts` que a
// claim conquistou. Um worker antigo (geração anterior) que volta depois de um
// reclaim por stale tem attempts defasado → não marca nada (evita sobrescrever
// o estado produzido pela claim mais nova). É a MESMA condição do WHERE do
// UPDATE — testável aqui.
export function podeMarcar(
  row: { status: string; attempts: number | null | undefined },
  generation: number
): boolean {
  return row.status === "processing" && (row.attempts ?? 0) === generation;
}

// Rank de "privilégio" do status da assinatura: MENOR = mais terminal. Usado só
// para desempatar eventos com o MESMO timestamp (Stripe dá `created` em
// segundos). Fail-closed para entitlement: sob empate, o cancelamento (0) vence
// a ativação (3) — nunca reabrimos acesso por causa de um empate de relógio.
const STATUS_RANK: Record<string, number> = {
  canceled: 0,
  past_due: 1,
  none: 1,
  trialing: 2,
  active: 3,
};
function statusRank(s: string): number {
  return STATUS_RANK[s] ?? 1;
}

// Decisão PURA de ORDEM por organização/assinatura, determinística e fail-closed:
//   - sem efeito anterior (at null) → aplica;
//   - evento mais NOVO (created maior) → aplica;
//   - evento ATRASADO (created menor) → ignora (não reabre estado mais recente);
//   - EMPATE de timestamp → aplica só se o novo for IGUAL ou MAIS terminal
//     (rank <=). Assim deleted(T) vence updated(T) independentemente da ordem de
//     chegada, e um updated(T) nunca reabre um canceled(T). O caller serializa
//     por organização (lock da linha) para a decisão ser atômica.
export function deveAplicarEfeito(
  current: { status: string; at: Date | null },
  incoming: { status: string; at: Date }
): boolean {
  if (current.at === null) return true;
  const t = current.at.getTime();
  const e = incoming.at.getTime();
  if (e > t) return true;
  if (e < t) return false;
  return statusRank(incoming.status) <= statusRank(current.status);
}

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
