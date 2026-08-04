import { describe, it, expect } from "vitest";
import { toDriverPublic, toDriverPii } from "./_core/driverDto";
import type { Driver } from "../drizzle/schema";

const full = {
  id: 1,
  orgId: 7,
  nome: "Fulano",
  cpf: "12345678901",
  email: "f@x.com",
  telefone: "27999990000",
  cnh: "99999999999",
  cnhCategoria: "E",
  cnhVencimento: new Date("2027-01-01"),
  status: "disponivel",
  disponibilidade: true,
  endereco: "Rua X, 10",
  dataAdmissao: new Date("2026-01-01"),
  observacoes: "obs",
  trackingToken: "tok_plaintext",
  trackingTokenHash: "hash_abc",
  trackingTokenExpiresAt: new Date("2027-01-01"),
  trackingTokenRotatedAt: new Date("2026-06-01"),
  trackingTokenRevokedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-02-01"),
} as unknown as Driver;

const TOKEN_KEYS = [
  "trackingToken",
  "trackingTokenHash",
  "trackingTokenExpiresAt",
  "trackingTokenRotatedAt",
  "trackingTokenRevokedAt",
];
const PII_KEYS = ["cpf", "cnh", "email", "telefone", "endereco", "observacoes"];

describe("toDriverPublic — DTO operacional (item 2)", () => {
  const dto = toDriverPublic(full) as Record<string, unknown>;
  it("NÃO contém credencial de rastreio (token/hash/expiração/rotação/revogação)", () => {
    for (const k of TOKEN_KEYS) expect(dto).not.toHaveProperty(k);
  });
  it("NÃO contém PII (CPF/CNH/e-mail/telefone/endereço)", () => {
    for (const k of PII_KEYS) expect(dto).not.toHaveProperty(k);
  });
  it("mantém o operacional (id/nome/status/cnhVencimento p/ atribuição e alertas)", () => {
    expect(dto.id).toBe(1);
    expect(dto.nome).toBe("Fulano");
    expect(dto.status).toBe("disponivel");
    expect(dto.cnhVencimento).toBeInstanceOf(Date);
  });
});

describe("toDriverPii — DTO do dono (item 2)", () => {
  const dto = toDriverPii(full) as Record<string, unknown>;
  it("NÃO contém a credencial de rastreio (token/hash nunca vão ao browser)", () => {
    for (const k of TOKEN_KEYS) expect(dto).not.toHaveProperty(k);
  });
  it("contém a PII para o cadastro/edição (owner)", () => {
    expect(dto.cpf).toBe("12345678901");
    expect(dto.cnh).toBe("99999999999");
    expect(dto.email).toBe("f@x.com");
    expect(dto.telefone).toBe("27999990000");
    expect(dto.endereco).toBe("Rua X, 10");
  });
});
