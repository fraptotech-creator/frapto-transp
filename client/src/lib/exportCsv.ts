import { sanitizeCsvCell } from "./csvSafe";

// Monta um CSV (UTF-8 com BOM p/ Excel) de um array de objetos e dispara o
// download no navegador. Células saneadas contra fórmula-injection. Retorna
// false se não há linhas (o chamador decide a mensagem).
export function downloadCsvFile(
  filename: string,
  rows: Record<string, unknown>[]
): boolean {
  if (!rows || rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const csvBody =
    headers.join(",") +
    "\n" +
    rows.map(r => headers.map(h => sanitizeCsvCell(r[h])).join(",")).join("\n");
  // BOM (﻿) para o Excel abrir em UTF-8.
  const blob = new Blob(["﻿" + csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
