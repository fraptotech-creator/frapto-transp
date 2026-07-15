import { describe, expect, it } from "vitest";
import { contemTexto, combinaPlaca } from "@/lib/searchFilters";

describe("contemTexto", () => {
  it("vazio passa; parcial e case-insensitive", () => {
    expect(contemTexto("Alexandre Firmino", "")).toBe(true);
    expect(contemTexto("Alexandre Firmino", "ale")).toBe(true);
    expect(contemTexto("Alexandre Firmino", "FIRM")).toBe(true);
    expect(contemTexto("Alexandre Firmino", "xyz")).toBe(false);
    expect(contemTexto(null, "ale")).toBe(false);
  });
});

describe("combinaPlaca", () => {
  it("ignora hífen/pontuação nos dois lados", () => {
    expect(combinaPlaca("ABC1234", "")).toBe(true);
    expect(combinaPlaca("ABC1234", "abc")).toBe(true);
    expect(combinaPlaca("ABC1234", "abc-12")).toBe(true);
    expect(combinaPlaca("ABC-1234", "abc1234")).toBe(true);
    expect(combinaPlaca("ABC1234", "1234")).toBe(true);
    expect(combinaPlaca("ABC1234", "zzz")).toBe(false);
  });
});
