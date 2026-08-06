import { describe, it, expect } from "vitest";
import { remarkNeutralizeMermaid } from "@/lib/aiSafeMarkdown";

// Nó mdast mínimo para o teste unitário do plugin (sem depender de @types/mdast).
type Node = { type: string; lang?: string | null; children?: Node[] };

function run(tree: Node): Node {
  remarkNeutralizeMermaid()(tree);
  return tree;
}

describe("remarkNeutralizeMermaid — AST (item 1)", () => {
  it("reescreve lang mermaid → text na RAIZ", () => {
    const tree: Node = {
      type: "root",
      children: [{ type: "code", lang: "mermaid" }],
    };
    run(tree);
    expect(tree.children?.[0].lang).toBe("text");
  });

  it("reescreve dentro de blockquote e lista (aninhado)", () => {
    const tree: Node = {
      type: "root",
      children: [
        { type: "blockquote", children: [{ type: "code", lang: "mermaid" }] },
        {
          type: "list",
          children: [
            {
              type: "listItem",
              children: [{ type: "code", lang: "MERMAID" }],
            },
          ],
        },
      ],
    };
    run(tree);
    const bq = tree.children?.[0].children?.[0];
    const li = tree.children?.[1].children?.[0].children?.[0];
    expect(bq?.lang).toBe("text");
    expect(li?.lang).toBe("text"); // case-insensitive
  });

  it("NÃO altera outras linguagens", () => {
    const tree: Node = {
      type: "root",
      children: [
        { type: "code", lang: "js" },
        { type: "code", lang: null },
      ],
    };
    run(tree);
    expect(tree.children?.[0].lang).toBe("js");
    expect(tree.children?.[1].lang).toBeNull();
  });
});
