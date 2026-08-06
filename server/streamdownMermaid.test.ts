// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { Streamdown, defaultRemarkPlugins } from "streamdown";
import { remarkNeutralizeMermaid } from "@/lib/aiSafeMarkdown";
import { safeAiUrl } from "@/lib/aiSafeUrl";

afterEach(() => cleanup());

// Mesmos plugins do AIChatBox (defaults + neutralizador de Mermaid no AST).
const remarkPlugins = [
  ...Object.values(defaultRemarkPlugins),
  remarkNeutralizeMermaid,
];

// Componente REAL do Streamdown, como em produção.
function renderAssistant(content: string) {
  return render(
    createElement(Streamdown, {
      rehypePlugins: [],
      remarkPlugins,
      controls: false,
      urlTransform: safeAiUrl,
      children: content,
    })
  );
}

function semMermaidNemAtivo(container: HTMLElement) {
  expect(
    container.querySelector("[data-streamdown='mermaid-block']")
  ).toBeNull();
  expect(container.querySelector("svg")).toBeNull();
  expect(
    container.querySelector(
      "iframe, script, [srcdoc], [onerror], [onload], [onclick]"
    )
  ).toBeNull();
}

describe("Streamdown REAL — Mermaid desabilitado estruturalmente (item 1)", () => {
  it("controle POSITIVO: mermaid CRU (sem o plugin) produz mermaid-block", () => {
    const { container } = render(
      createElement(Streamdown, {
        children: "```mermaid\ngraph TD; A-->B;\n```",
      })
    );
    expect(
      container.querySelector("[data-streamdown='mermaid-block']")
    ).not.toBeNull();
  });

  const casos: Array<[string, string]> = [
    ["crases na raiz", "```mermaid\ngraph TD; A-->B;\n```"],
    ["tils na raiz", "~~~mermaid\ngraph TD; A-->B;\n~~~"],
    ["blockquote + crases", "> ```mermaid\n> graph TD; A-->B;\n> ```"],
    ["blockquote + tils", "> ~~~mermaid\n> graph TD; A-->B;\n> ~~~"],
    ["dentro de lista", "- item\n\n  ```mermaid\n  graph TD; A-->B;\n  ```"],
    ["case/atributos no info", "```MERMAID  theme=dark\ngraph TD;\n```"],
  ];
  for (const [nome, md] of casos) {
    it(`${nome} → código inerte, sem mermaid/svg`, () => {
      const { container } = renderAssistant(md);
      semMermaidNemAtivo(container);
    });
  }

  it("Markdown, tabela e link HTTPS continuam funcionando", () => {
    const { container } = renderAssistant(
      "**forte** [ok](https://x.com)\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x=1;\n```"
    );
    expect(
      container.querySelector("[data-streamdown='strong']")?.textContent
    ).toBe("forte");
    expect(
      container.querySelector("a[data-streamdown='link']")?.getAttribute("href")
    ).toContain("x.com");
    expect(container.querySelector("table")).not.toBeNull();
    // bloco de código comum segue sendo renderizado
    expect(
      container.querySelector("[data-code-block-container]")
    ).not.toBeNull();
  });
});
