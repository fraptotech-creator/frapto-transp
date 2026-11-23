// Datas SEM hora (vencimento de CRLV/seguro/CNH, data de despesa/receita,
// datas de manutenção, admissão) saem do <input type="date"> como "AAAA-MM-DD"
// e `new Date("AAAA-MM-DD")` as grava como MEIA-NOITE UTC. Formatá-las no fuso
// do navegador (UTC-3) mostra o DIA ANTERIOR — bug ao vivo em 23/11/2026: CRLV
// cadastrado para 10/01/2027 aparecia como 09/01/2027 na tela e no CSV.
// Aqui o dia é lido no calendário UTC, que é exatamente o dia digitado.
// NÃO usar para data+hora (partida/chegada de viagem): essas são instantes
// reais e devem continuar no fuso local.

type Entrada = Date | string | number | null | undefined;

function paraDate(d: Entrada): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Date LOCAL à meia-noite do mesmo dia de calendário — serve para date-fns
// `format(...)` e para comparar com outras datas locais.
export function dataPura(d: Entrada): Date | null {
  const dt = paraDate(d);
  if (!dt) return null;
  return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

// "dd/mm/aaaa" do dia digitado ("" se vazio/inválido).
export function formatarDataPura(d: Entrada): string {
  const dt = paraDate(d);
  if (!dt) return "";
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
}

// "AAAA-MM" do dia digitado (filtros por mês).
export function anoMesPuro(d: Entrada): string {
  const dt = paraDate(d);
  if (!dt) return "";
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
