// A saída do assistente é conteúdo NÃO-confiável. O Streamdown processa fences
// ```mermaid num componente especial que renderiza SVG via dangerouslySetInnerHTML
// (cadeia mermaid→DOMPurify com advisories). Como a IA de frota não precisa de
// diagramas, NEUTRALIZAMOS o fence ANTES de renderizar: reescrevemos a linguagem
// `mermaid` para `text`, então o Streamdown mostra um bloco de código INERTE (sem
// diagrama, sem dangerouslySetInnerHTML). Não é sanitização caseira de HTML — só
// troca o rótulo da linguagem do fence. O restante do Markdown segue igual.
//
// Casa a LINHA de abertura de um fence (3+ crases, com indentação opcional)
// cujo info-string começa por "mermaid" (ex.: ```mermaid, ~~~mermaid não é
// suportado pelo Streamdown, então cobrimos crases). Preserva a indentação e as
// crases; troca só o "mermaid".
const MERMAID_FENCE = /^(\s*`{3,})[ \t]*mermaid\b[^\n]*$/gim;

export function neutralizeMermaidFences(md: string): string {
  if (!md) return md;
  return md.replace(MERMAID_FENCE, "$1text");
}
