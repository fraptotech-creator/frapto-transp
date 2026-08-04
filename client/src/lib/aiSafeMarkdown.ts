// A saída do assistente é conteúdo NÃO-confiável. O Streamdown processa fences
// ```mermaid num componente especial que renderiza SVG via dangerouslySetInnerHTML
// (cadeia mermaid→DOMPurify com advisories). Como a IA de frota não precisa de
// diagramas, NEUTRALIZAMOS o fence ANTES de renderizar: reescrevemos a linguagem
// `mermaid` para `text`, então o Streamdown mostra um bloco de código INERTE (sem
// diagrama, sem dangerouslySetInnerHTML). Não é sanitização caseira de HTML — só
// troca o rótulo da linguagem do fence. O restante do Markdown segue igual.
//
// Casa a LINHA de abertura de um fence de código cujo info-string começa por
// "mermaid" — cobrindo AMBOS os delimitadores do CommonMark/remark: crases
// (```) e tils (~~~), 3 ou mais, com indentação opcional. Preserva o
// delimitador e a indentação (grupo 1); troca só o rótulo "mermaid" por "text".
// O fence de fechamento (mesmo delimitador) não é tocado. `\b` evita casar
// "mermaidX"; `[^\n]*` engole atributos no info-string (ex.: ```mermaid foo).
const MERMAID_FENCE = /^(\s*(?:`{3,}|~{3,}))[ \t]*mermaid\b[^\n]*$/gim;

export function neutralizeMermaidFences(md: string): string {
  if (!md) return md;
  return md.replace(MERMAID_FENCE, "$1text");
}
