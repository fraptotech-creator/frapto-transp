// Anti CSV/formula-injection. Uma célula que começa com = + - @ (ou TAB/CR) é
// interpretada como FÓRMULA pelo Excel/Google Sheets — um dado do usuário
// (ex.: nome, descrição) vindo com "=..." vira execução na máquina de quem abre
// a planilha. Prefixa com aspa simples para neutralizar, e faz o escaping CSV
// padrão (aspas/vírgula/quebra). Pura e testável.
export function sanitizeCsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
