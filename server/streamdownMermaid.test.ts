// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { Streamdown } from "streamdown";
import { neutralizeMermaidFences } from "@/lib/aiSafeMarkdown";
import { safeAiUrl } from "@/lib/aiSafeUrl";

afterEach(() => cleanup());

// Renderiza pelo COMPONENTE REAL do Streamdown (o mesmo do AIChatBox), com o
// conteúdo já passado por neutralizeMermaidFences — como em produção.
function renderAssistant(content: string) {
  return render(
    createElement(Streamdown, {
      rehypePlugins: [],
      controls: false,
      urlTransform: safeAiUrl,
      children: neutralizeMermaidFences(content),
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

describe("Streamdown REAL — Mermaid desabilitado nos dois delimitadores (item 4)", () => {
  it("controle POSITIVO: mermaid CRU (sem neutralizar) produz mermaid-block", () => {
    // Prova que o teste realmente detecta o Mermaid quando presente.
    const { container } = render(
      createElement(Streamdown, {
        children: "```mermaid\ngraph TD; A-->B;\n```",
      })
    );
    expect(
      container.querySelector("[data-streamdown='mermaid-block']")
    ).not.toBeNull();
  });

  it("crases ```mermaid → bloco de código inerte (language text), sem mermaid/svg", () => {
    const { container } = renderAssistant("```mermaid\ngraph TD; A-->B;\n```");
    semMermaidNemAtivo(container);
    // virou um bloco de CÓDIGO comum (não diagrama).
    expect(
      container.querySelector("[data-code-block-container]")
    ).not.toBeNull();
  });

  it("tils ~~~mermaid → código inerte, sem mermaid/svg", () => {
    const { container } = renderAssistant("~~~mermaid\ngraph TD; A-->B;\n~~~");
    semMermaidNemAtivo(container);
    expect(
      container.querySelector("[data-code-block-container]")
    ).not.toBeNull();
  });

  it("indentação/case/atributos no info-string também neutralizam", () => {
    const { container } = renderAssistant(
      "  ```MERMAID  extra\n  graph TD; A-->B;\n  ```"
    );
    semMermaidNemAtivo(container);
  });

  it("Markdown, tabela e link seguro continuam funcionando", () => {
    const { container } = renderAssistant(
      "**forte** [ok](https://x.com)\n\n| a | b |\n|---|---|\n| 1 | 2 |"
    );
    expect(
      container.querySelector("[data-streamdown='strong']")?.textContent
    ).toBe("forte");
    const link = container.querySelector("a[data-streamdown='link']");
    expect(link?.getAttribute("href")).toContain("x.com");
    expect(container.querySelector("table")).not.toBeNull();
  });
});
