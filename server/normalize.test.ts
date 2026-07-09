import { describe, it, expect } from "vitest";
import {
  onlyDigits,
  normalizePlaca,
  normalizeOptionalPhone,
} from "./_core/normalize";

describe("onlyDigits", () => {
  it("remove sinais de telefone/CPF", () => {
    expect(onlyDigits("(27) 99919-0405")).toBe("27999190405");
    expect(onlyDigits("085.022.747-08")).toBe("08502274708");
    expect(onlyDigits("123 456 789 00")).toBe("12345678900");
  });
  it("já-só-dígitos não muda", () => {
    expect(onlyDigits("27999190405")).toBe("27999190405");
  });
});

describe("normalizePlaca", () => {
  it("remove hífen/espaço e deixa maiúsculo", () => {
    expect(normalizePlaca("abc-1234")).toBe("ABC1234");
    expect(normalizePlaca("ABC 1234")).toBe("ABC1234");
    expect(normalizePlaca("abc1d23")).toBe("ABC1D23"); // Mercosul
  });
});

describe("normalizeOptionalPhone", () => {
  it("normaliza quando presente", () => {
    expect(normalizeOptionalPhone("(27) 99919-0405")).toBe("27999190405");
  });
  it("vazio/nulo → null (não conflita no índice único)", () => {
    expect(normalizeOptionalPhone("")).toBeNull();
    expect(normalizeOptionalPhone(null)).toBeNull();
    expect(normalizeOptionalPhone(undefined)).toBeNull();
    expect(normalizeOptionalPhone("---")).toBeNull();
  });
});
