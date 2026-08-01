// Quota de armazenamento de documentos por empresa (decisão do produto: 5 GB).
// Sem teto, uma empresa podia encher o bucket R2 (custo/abuso). Decisão PURA,
// testável; a borda (router de documentos) soma o uso e checa antes do upload.
export const DOC_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

// true se adicionar `newBytes` ao uso atual estoura a quota. Fail-closed:
// valores não-finitos/negativos são tratados como estouro.
export function quotaExcedida(
  usedBytes: number,
  newBytes: number,
  quotaBytes: number = DOC_QUOTA_BYTES
): boolean {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(newBytes)) return true;
  if (usedBytes < 0 || newBytes < 0) return true;
  return usedBytes + newBytes > quotaBytes;
}
