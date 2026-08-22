import { describe, it, expect } from "vitest";
import {
  parseNumericString,
  parseRequiredNumericString,
  parseIntOrNull,
} from "./routers/_helpers";

describe("parseNumericString (não-negativo, finito, com teto)", () => {
  it("ausente vira null (campo opcional)", () => {
    expect(parseNumericString(undefined)).toBeNull();
    expect(parseNumericString(null)).toBeNull();
    expect(parseNumericString("")).toBeNull();
  });

  it("número válido passa (normalizado)", () => {
    expect(parseNumericString("10.50")).toBe("10.5");
    expect(parseNumericString("0")).toBe("0");
    expect(parseNumericString("1200")).toBe("1200");
  });

  it("REJEITA negativo (antes -100 virava '-100' no banco)", () => {
    expect(() => parseNumericString("-100")).toThrow(/inválido/i);
    expect(() => parseNumericString("-0.01")).toThrow(/inválido/i);
  });

  it("REJEITA não-finito (Infinity/NaN via 1e999 ou lixo)", () => {
    expect(() => parseNumericString("1e999")).toThrow(/inválido/i);
    expect(() => parseNumericString("abc")).toThrow(/inválido/i);
  });

  it("REJEITA acima do teto de sanidade", () => {
    expect(() => parseNumericString("1e13")).toThrow(/inválido/i);
  });
});

describe("parseRequiredNumericString", () => {
  it("exige valor (ausente é erro)", () => {
    expect(() => parseRequiredNumericString("")).toThrow(
      /Valor numérico inválido/
    );
  });
  it("propaga a rejeição de negativo/absurdo", () => {
    expect(() => parseRequiredNumericString("-5")).toThrow(/inválido/i);
    expect(() => parseRequiredNumericString("1e999")).toThrow(/inválido/i);
  });
  it("aceita válido", () => {
    expect(parseRequiredNumericString("42.5")).toBe("42.5");
  });
});

describe("parseIntOrNull (passageiros — inteiro não-negativo opcional)", () => {
  it("ausente vira null", () => {
    expect(parseIntOrNull(undefined)).toBeNull();
    expect(parseIntOrNull(null)).toBeNull();
    expect(parseIntOrNull("")).toBeNull();
    expect(parseIntOrNull("  ")).toBeNull();
  });
  it("inteiro válido passa como número", () => {
    expect(parseIntOrNull("45")).toBe(45);
    expect(parseIntOrNull("0")).toBe(0);
  });
  it("REJEITA fracionário, negativo, NaN e absurdo", () => {
    expect(() => parseIntOrNull("45.5")).toThrow(/inválid/i);
    expect(() => parseIntOrNull("-1")).toThrow(/inválid/i);
    expect(() => parseIntOrNull("abc")).toThrow(/inválid/i);
    expect(() => parseIntOrNull("100001")).toThrow(/inválid/i);
  });
});
