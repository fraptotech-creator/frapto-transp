// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { AIChatBox } from "@/components/AIChatBox";

// Trava do bug de 25/11/2026: no celular, uma resposta da IA com TABELA fazia a
// bolha inteira passar da largura da tela — texto e tabela cortados, sem como
// arrastar para o lado. Causa: o Radix ScrollArea envolve o conteúdo num div com
// display:table, que cresce até a largura do conteúdo (medido: caixa 292px,
// conteúdo 620px). O jsdom não calcula layout, então travamos as 3 peças da
// correção (medida em navegador real: conteúdo 316 = caixa 316, tabela rola).

beforeAll(() => {
  // Radix ScrollArea usa ResizeObserver, que o jsdom não tem.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});
afterEach(() => cleanup());

const TABELA = `Motoristas com CNH vencida:

| Nome | Categoria | Vencimento | Situação |
|---|---|---|---|
| Motorista Um | F | 12/11/2026 | Vencida |`;

function renderChat() {
  return render(
    createElement(AIChatBox, {
      messages: [
        { role: "user", content: "Quais CNHs vencem?" },
        { role: "assistant", content: TABELA },
      ],
      onSendMessage: () => {},
    })
  );
}

describe("AIChatBox — resposta larga não passa da tela", () => {
  it("o ScrollArea força display:block no wrapper interno do Radix", () => {
    const { container } = renderChat();
    const raiz = container.querySelector('[data-slot="scroll-area"]');
    expect(raiz?.className).toContain(
      "[&_[data-radix-scroll-area-viewport]>div]:!block"
    );
  });

  it("a bolha da resposta pode encolher (min-w-0) e respeita a largura", () => {
    const { container } = renderChat();
    const bolha = container.querySelector(".prose")?.parentElement;
    expect(bolha?.className).toContain("min-w-0");
    expect(bolha?.className).toContain("max-w-[calc(100%-2.75rem)]");
  });

  it("a tabela fica dentro de um contêiner com rolagem horizontal", () => {
    const { container } = renderChat();
    const tabela = container.querySelector("table");
    expect(tabela).not.toBeNull();
    let e = tabela?.parentElement ?? null;
    let rolavel = false;
    while (e && !e.classList.contains("prose")) {
      if (e.className.includes("overflow-x-auto")) rolavel = true;
      e = e.parentElement;
    }
    expect(rolavel).toBe(true);
  });
});
