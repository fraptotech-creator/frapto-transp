// Saneia URLs de links/imagens na saída da IA (conteúdo não-confiável). Bloqueia
// protocolos perigosos (javascript:, data:, vbscript:, file:) e força https —
// permite só https, mailto e tel, além de relativo/âncora. Passado ao
// urlTransform do Streamdown/react-markdown. Puro — testado.
export function safeAiUrl(url: string): string {
  if (!url) return "";
  // Relativo ou âncora interna: seguro.
  if (url.startsWith("#") || url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    return ["https:", "mailto:", "tel:"].includes(u.protocol) ? url : "";
  } catch {
    // Não parseável como URL absoluta → bloqueia (fail-closed).
    return "";
  }
}
