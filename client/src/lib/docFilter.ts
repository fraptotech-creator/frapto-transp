// Filtro PURO de documentos por termo (tipo + descrição + vínculo: placa do
// veículo / nome do motorista). Vazio = tudo.
export function filtrarDocumentos<
  T extends {
    tipo: string;
    descricao?: string | null;
    vinculo?: string | null;
  },
>(docs: T[], termo: string): T[] {
  const t = termo.trim().toLowerCase();
  if (!t) return docs;
  return docs.filter(d =>
    `${d.tipo} ${d.descricao ?? ""} ${d.vinculo ?? ""}`
      .toLowerCase()
      .includes(t)
  );
}
