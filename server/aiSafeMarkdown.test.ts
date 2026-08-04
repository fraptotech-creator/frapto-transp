// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import Markdown from "react-markdown";
import { neutralizeMermaidFences } from "@/lib/aiSafeMarkdown";
import { safeAiUrl } from "@/lib/aiSafeUrl";

afterEach(() => cleanup());

describe("neutralizeMermaidFences — desabilita Mermaid (item 6)", () => {
  it("reescreve ```mermaid → ```text (relabel do fence)", () => {
    const out = neutralizeMermaidFences("```mermaid\ngraph TD; A-->B;\n```");
    expect(out).toContain("```text");
    expect(out).not.toMatch(/```mermaid/);
    // conteúdo do bloco preservado (vira código inerte)
    expect(out).toContain("graph TD; A-->B;");
  });

  it("fence mermaid INDENTADO também é neutralizado", () => {
    const out = neutralizeMermaidFences("  ```mermaid\n  graph TD;\n  ```");
    expect(out).not.toMatch(/```mermaid/);
  });

  it("NÃO altera outras linguagens nem a palavra 'mermaid' no texto", () => {
    const js = "```js\nconst x = 1;\n```";
    expect(neutralizeMermaidFences(js)).toBe(js);
    const prosa = "Aqui falo sobre mermaid em uma frase.";
    expect(neutralizeMermaidFences(prosa)).toBe(prosa);
  });

  it("vários fences: só os mermaid mudam", () => {
    const md = "```mermaid\nA-->B\n```\n\n```python\nx=1\n```";
    const out = neutralizeMermaidFences(md);
    expect(out).toContain("```text");
    expect(out).toContain("```python");
  });
});

// Prova de render: o conteúdo NEUTRALIZADO, no motor do Streamdown
// (react-markdown), NÃO vira um bloco mermaid (language-mermaid) — logo o
// Streamdown não aciona o componente de diagrama (dangerouslySetInnerHTML).
function renderAi(content: string) {
  return render(
    createElement(Markdown, {
      rehypePlugins: [],
      urlTransform: safeAiUrl,
      children: neutralizeMermaidFences(content),
    })
  );
}

describe("saída da IA — Mermaid NÃO renderiza diagrama (item 6)", () => {
  it("fence mermaid vira código inerte (language-text), sem language-mermaid nem SVG", () => {
    const { container } = renderAi("```mermaid\ngraph TD; A-->B;\n```");
    expect(container.querySelector("code.language-mermaid")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("code.language-text")).not.toBeNull();
  });

  it("Markdown normal segue funcionando; HTML cru continua inerte", () => {
    const { container } = renderAi(
      "**forte** e `x`\n\n<iframe srcdoc=x></iframe>"
    );
    expect(container.querySelector("strong")?.textContent).toBe("forte");
    expect(container.querySelector("iframe")).toBeNull();
  });
});
