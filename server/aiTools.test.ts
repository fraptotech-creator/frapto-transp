import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({
  getVehicles: vi.fn().mockResolvedValue([
    {
      id: 1,
      placa: "AAA1111",
      marca: "Volvo",
      modelo: "FH",
      status: "ativo",
      quilometragem: 9500,
      kmUltimaTrocaOleo: 9500,
      intervaloTrocaOleoKm: 10000,
    },
  ]),
  getDrivers: vi.fn().mockResolvedValue([
    {
      id: 7,
      orgId: 1,
      nome: "João Teste",
      cpf: "11144477735",
      cnh: "12345678900",
      cnhCategoria: "E",
      cnhVencimento: new Date("2099-01-01"),
      telefone: "27999991234",
      email: "joao@exemplo.com",
      endereco: "Rua A, 1",
      status: "disponivel",
    },
  ]),
  getTrips: vi.fn().mockResolvedValue([]),
  getMaintenances: vi.fn().mockResolvedValue([]),
  getExpenses: vi.fn().mockResolvedValue([]),
  getRevenues: vi.fn().mockResolvedValue([]),
}));

import { runAiTool, toOpenAiTools } from "./_core/aiTools";

// Trava da auditoria 23/11/2026: a ferramenta devolvia número da CNH e
// telefone — PII que vai ao provedor de IA e que `ai.chat` (aberto a member)
// expunha apesar de drivers.pii ser só do dono.
describe("listar_motoristas não vaza dados pessoais", () => {
  it("só nome, categoria, vencimento, situação e status", async () => {
    const out = JSON.parse(await runAiTool(1, "listar_motoristas", "{}"));
    const texto = JSON.stringify(out);
    for (const pii of [
      "12345678900",
      "11144477735",
      "27999991234",
      "joao@exemplo.com",
      "Rua A",
    ]) {
      expect(texto).not.toContain(pii);
    }
    expect(Object.keys(out[0]).sort()).toEqual(
      [
        "categoria",
        "cnhVencida",
        "diasParaVencerCnh",
        "nome",
        "status",
        "vencimentoCnh",
      ].sort()
    );
  });
});

describe("aiTools", () => {
  it("expõe as ferramentas no formato OpenAI", () => {
    const names = toOpenAiTools().map(t => t.function.name);
    expect(names).toContain("listar_veiculos");
    expect(names).toContain("listar_viagens");
    expect(names).toContain("resumo_financeiro");
    expect(names).toContain("extrato_financeiro");
  });

  it("listar_veiculos devolve placa + situação do óleo", async () => {
    const data = JSON.parse(await runAiTool(1, "listar_veiculos", "{}"));
    expect(data[0].placa).toBe("AAA1111");
    expect(data[0].oleo).toBe("em dia");
  });

  it("ferramenta desconhecida → erro (não lança)", async () => {
    const out = JSON.parse(await runAiTool(1, "xpto", "{}"));
    expect(out.erro).toMatch(/desconhecida/i);
  });

  // Trava do bug de 25/11/2026: o modelo manda filtro opcional como `null`
  // ({"status":null}); o Groq valida contra o schema e, com type "string" puro,
  // rejeitava a chamada inteira (400 tool_use_failed) → "Erro interno" na tela.
  it("todo parâmetro opcional aceita null no schema", () => {
    for (const t of toOpenAiTools()) {
      const params = t.function.parameters as {
        properties: Record<string, { type: unknown }>;
        required?: string[];
      };
      for (const [nome, p] of Object.entries(params.properties)) {
        if (params.required?.includes(nome)) continue;
        expect(
          Array.isArray(p.type) && p.type.includes("null"),
          `${t.function.name}.${nome} precisa aceitar null`
        ).toBe(true);
      }
    }
  });

  it('filtro null ({"status":null}) = sem filtro, não erro', async () => {
    const out = JSON.parse(
      await runAiTool(1, "listar_viagens", '{"status":null}')
    );
    expect(Array.isArray(out)).toBe(true);
  });

  it("args em JSON inválido não quebram", async () => {
    const data = JSON.parse(await runAiTool(1, "listar_veiculos", "{quebrado"));
    expect(data[0].placa).toBe("AAA1111");
  });
});
