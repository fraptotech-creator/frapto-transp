// Filtro PURO de documentos por termo (tipo + descrição). Vazio = tudo.
export function filtrarDocumentos<
  T extends { tipo: string; descricao?: string | null },
>(docs: T[], termo: string): T[] {
  const t = termo.trim().toLowerCase();
  if (!t) return docs;
  return docs.filter(d =>
    `${d.tipo} ${d.descricao ?? ""}`.toLowerCase().includes(t)
  );
}
