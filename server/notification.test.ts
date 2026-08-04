import { describe, it, expect, vi, afterEach } from "vitest";
import { notifyOwner } from "./_core/notification";

afterEach(() => vi.restoreAllMocks());

describe("notifyOwner — não loga texto livre (item 6)", () => {
  it("loga só metadados (tamanhos); PII do título/conteúdo NÃO chega ao log", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const title = "Novo cliente João Silva";
    const content =
      "Contato: joao@x.com, tel 27 99999-0000, CPF 123.456.789-01, Rua das Flores 123.";
    await notifyOwner({ title, content });
    const logged = spy.mock.calls.map(c => c.join(" ")).join("\n");
    for (const leak of [
      "João Silva",
      "joao@x.com",
      "99999-0000",
      "123.456.789-01",
      "Rua das Flores",
    ]) {
      expect(logged).not.toContain(leak);
    }
    // metadados técnicos presentes
    expect(logged).toContain(`content=${content.length}c`);
  });
});
