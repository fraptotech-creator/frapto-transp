import { describe, expect, it } from "vitest";
import { filtrarDocumentos } from "@/lib/docFilter";

const docs = [
  { id: 1, tipo: "cnh", descricao: "CNH João" },
  { id: 2, tipo: "crlv", descricao: "CRLV ABC1234" },
  { id: 3, tipo: "seguro", descricao: null },
];

describe("filtrarDocumentos", () => {
  it("termo vazio devolve tudo", () => {
    expect(filtrarDocumentos(docs, "")).toHaveLength(3);
    expect(filtrarDocumentos(docs, "  ")).toHaveLength(3);
  });

  it("filtra por tipo e por descrição (case-insensitive)", () => {
    expect(filtrarDocumentos(docs, "cnh").map(d => d.id)).toEqual([1]);
    expect(filtrarDocumentos(docs, "abc1234").map(d => d.id)).toEqual([2]);
    expect(filtrarDocumentos(docs, "SEGURO").map(d => d.id)).toEqual([3]);
  });

  it("sem match → vazio", () => {
    expect(filtrarDocumentos(docs, "xyz")).toEqual([]);
  });
});
