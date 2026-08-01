import { describe, it, expect } from "vitest";
import { sanitizeCsvCell } from "@/lib/csvSafe";

describe("sanitizeCsvCell — anti formula-injection (Lote A)", () => {
  it("neutraliza célula que começa com = + - @ TAB CR", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvCell("-2")).toBe("'-2");
    expect(sanitizeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeCsvCell("\tx")).toBe("'\tx");
    expect(sanitizeCsvCell("\rx")).toBe("'\rx");
  });

  it("payload clássico de exfiltração vira texto inerte", () => {
    const out = sanitizeCsvCell('=HYPERLINK("http://mau","x")');
    expect(out.startsWith("'") || out.startsWith("\"'")).toBe(true);
    expect(out).not.toMatch(/^=/);
  });

  it("texto normal passa; escaping CSV de aspas/vírgula/quebra", () => {
    expect(sanitizeCsvCell("João")).toBe("João");
    expect(sanitizeCsvCell("a,b")).toBe('"a,b"');
    expect(sanitizeCsvCell('a"b')).toBe('"a""b"');
    expect(sanitizeCsvCell("a\nb")).toBe('"a\nb"');
  });

  it("null/undefined → vazio", () => {
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
  });
});
