import { TRPCError } from "@trpc/server";

// Resultado de uma exclusão (PURA). Antes, todo delete respondia
// { success: true } mesmo quando o DELETE não apagava nada — id que não existe,
// já excluído em outra aba, ou de outra empresa (o filtro por orgId zera as
// linhas). O usuário via "excluído" sem nada ter acontecido. Agora 0 linhas
// apagadas = NOT_FOUND com mensagem legível; o isolamento entre empresas segue
// igual (a resposta não revela se o id existe em outra org).
export function confirmarExclusao(
  removidos: number,
  naoEncontrado: string
): { success: true } {
  if (removidos > 0) return { success: true };
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `${naoEncontrado} O registro pode já ter sido excluído — atualize a página.`,
  });
}

// Linhas afetadas de um DELETE do drizzle/mysql2 ([ResultSetHeader, ...]).
export function linhasAfetadas(res: unknown): number {
  const cabecalho = Array.isArray(res) ? res[0] : res;
  const n = (cabecalho as { affectedRows?: unknown } | null | undefined)
    ?.affectedRows;
  return typeof n === "number" ? n : 0;
}
