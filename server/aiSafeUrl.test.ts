import { describe, it, expect } from "vitest";
import { safeAiUrl } from "@/lib/aiSafeUrl";

describe("safeAiUrl — saneia URLs da saída da IA (Lote 10)", () => {
  it("BLOQUEIA protocolos perigosos", () => {
    expect(safeAiUrl("javascript:alert(1)")).toBe("");
    expect(safeAiUrl("JavaScript:alert(1)")).toBe("");
    expect(safeAiUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(safeAiUrl("vbscript:msgbox(1)")).toBe("");
    expect(safeAiUrl("file:///etc/passwd")).toBe("");
  });

  it("força https (bloqueia http)", () => {
    expect(safeAiUrl("http://exemplo.com")).toBe("");
    expect(safeAiUrl("https://exemplo.com")).toBe("https://exemplo.com");
  });

  it("permite mailto/tel e relativo/âncora", () => {
    expect(safeAiUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeAiUrl("tel:+551199999")).toBe("tel:+551199999");
    expect(safeAiUrl("/motorista")).toBe("/motorista");
    expect(safeAiUrl("#secao")).toBe("#secao");
  });

  it("vazio/inválido → vazio (fail-closed)", () => {
    expect(safeAiUrl("")).toBe("");
    expect(safeAiUrl("::: nao url :::")).toBe("");
  });
});
