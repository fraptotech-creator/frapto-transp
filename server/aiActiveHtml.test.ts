// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import Markdown from "react-markdown";
import { safeAiUrl } from "@/lib/aiSafeUrl";

// O AIChatBox renderiza a saída da IA com <Streamdown rehypePlugins={[]}
// urlTransform={safeAiUrl}> — o Streamdown apenas repassa essas props ao
// react-markdown (confirmado no dist: `rehypePlugins:n`). Aqui exercitamos o
// MESMO motor com as MESMAS props, de forma DETERMINÍSTICA (render síncrono).
// Sem rehype-raw, o react-markdown NÃO cria elementos a partir do HTML cru — ele
// vira TEXTO inerte (escapado). Provamos que nenhum ELEMENTO/ATRIBUTO ativo
// chega ao DOM (substring do innerHTML não serve: o texto escapado contém
// "iframe"/"srcdoc" de forma inofensiva).
function renderAi(content: string) {
  return render(
    createElement(Markdown, {
      rehypePlugins: [],
      urlTransform: safeAiUrl,
      children: content,
    })
  );
}

// Nenhum elemento perigoso e nenhum handler/atributo ativo no DOM.
function semHtmlAtivo(container: HTMLElement) {
  expect(
    container.querySelector("iframe, script, svg, object, embed, style, form")
  ).toBeNull();
  expect(
    container.querySelector(
      "[srcdoc], [onerror], [onload], [onclick], [onmouseover], [onfocus]"
    )
  ).toBeNull();
}

afterEach(() => cleanup());

describe("saída da IA — sem HTML ativo no DOM (Lote A)", () => {
  it("iframe+srcdoc+script NÃO viram elementos ativos", () => {
    const { container } = renderAi(
      '<iframe srcdoc="<script>parent.XSS=1</script>"></iframe>'
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    semHtmlAtivo(container);
  });

  it("img onerror não vira elemento com handler", () => {
    const { container } = renderAi('<img src=x onerror="alert(1)">');
    expect(container.querySelector("img[onerror]")).toBeNull();
    semHtmlAtivo(container);
  });

  it("script solto e svg/onload não executam nem entram no DOM", () => {
    const { container } = renderAi(
      '<script>window.XSS=1</script><svg onload="alert(1)"></svg>'
    );
    semHtmlAtivo(container);
    expect((globalThis as Record<string, unknown>).XSS).toBeUndefined();
  });

  it("HTML ativo MISTURADO com Markdown: o Markdown fica, o HTML não vira elemento", () => {
    const { container } = renderAi(
      "Olá **mundo** <iframe srcdoc=x></iframe> e `código`"
    );
    expect(container.querySelector("strong")?.textContent).toBe("mundo");
    expect(container.querySelector("code")?.textContent).toBe("código");
    semHtmlAtivo(container);
  });

  it("link javascript: e data:text/html são neutralizados", () => {
    const { container } = renderAi(
      "[x](javascript:alert(1)) [y](data:text/html,alerta)"
    );
    const hrefs = Array.from(container.querySelectorAll("a")).map(a =>
      a.getAttribute("href")
    );
    for (const h of hrefs) {
      expect(h ?? "").not.toMatch(/^javascript:/i);
      expect(h ?? "").not.toMatch(/^data:/i);
    }
  });

  it("Markdown legítimo continua renderizando (negrito, link https, lista)", () => {
    const { container } = renderAi(
      "**forte** [ok](https://exemplo.com)\n\n- um\n- dois"
    );
    expect(container.querySelector("strong")?.textContent).toBe("forte");
    const link = container.querySelector('a[href="https://exemplo.com"]');
    expect(link?.textContent).toBe("ok");
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
  });
});
