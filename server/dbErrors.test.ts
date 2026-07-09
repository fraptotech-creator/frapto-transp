import { describe, it, expect } from "vitest";
import { friendlyDbErrorMessage } from "./_core/dbErrors";

// Simula o erro real: drizzle embrulha o mysql2 em DrizzleQueryError e põe o
// erro original em `.cause`.
function drizzleDup(key: string) {
  const mysqlErr = Object.assign(
    new Error(`Duplicate entry 'X' for key '${key}'`),
    { code: "ER_DUP_ENTRY", errno: 1062 }
  );
  return Object.assign(new Error("Failed query: insert into `vehicles` ..."), {
    cause: mysqlErr,
  });
}

describe("friendlyDbErrorMessage", () => {
  it("placa duplicada → mensagem clara, sem SQL", () => {
    const msg = friendlyDbErrorMessage(drizzleDup("vehicles.placa_org_unique"));
    expect(msg).toBe("Já existe um veículo com essa placa nesta empresa.");
    expect(msg).not.toMatch(/insert into|Failed query/i);
  });

  it("CPF duplicado", () => {
    expect(friendlyDbErrorMessage(drizzleDup("drivers.cpf_org_unique"))).toBe(
      "Já existe um motorista com esse CPF nesta empresa."
    );
  });

  it("CNH duplicada", () => {
    expect(friendlyDbErrorMessage(drizzleDup("drivers.cnh_org_unique"))).toBe(
      "Já existe um motorista com essa CNH nesta empresa."
    );
  });

  it("telefone duplicado", () => {
    expect(friendlyDbErrorMessage(drizzleDup("drivers_telefone_por_org"))).toBe(
      "Já existe um motorista com esse telefone nesta empresa."
    );
  });

  // TRAP do bug real: o wrapper do drizzle lista TODAS as colunas do INSERT
  // (inclui `cpf` E `cnh`). Se colidir a CNH, a mensagem tem de dizer CNH —
  // e NÃO CPF (que aparece antes na lista de colunas).
  it("colisão de CNH com wrapper listando cpf+cnh → mensagem de CNH", () => {
    const mysqlErr = Object.assign(
      new Error("Duplicate entry '1-X' for key 'drivers_cnh_por_org'"),
      { code: "ER_DUP_ENTRY", errno: 1062 }
    );
    const drizzleErr = Object.assign(
      new Error(
        "Failed query: insert into `drivers` (`id`, `orgId`, `nome`, `cpf`, `email`, `telefone`, `cnh`, `cnhCategoria`) values ..."
      ),
      { cause: mysqlErr }
    );
    expect(friendlyDbErrorMessage(drizzleErr)).toBe(
      "Já existe um motorista com essa CNH nesta empresa."
    );
  });

  it("número de viagem duplicado", () => {
    expect(
      friendlyDbErrorMessage(drizzleDup("trips.numero_viagem_org_unique"))
    ).toBe("Já existe uma viagem com esse número nesta empresa.");
  });

  it("duplicado sem campo conhecido → fallback genérico", () => {
    expect(friendlyDbErrorMessage(drizzleDup("some_other_key"))).toBe(
      "Registro duplicado: já existe um item com esses dados."
    );
  });

  it("detecta duplicado só pela mensagem (sem code)", () => {
    const err = new Error("Duplicate entry 'ABC' for key 'vehicles.placa'");
    expect(friendlyDbErrorMessage(err)).toBe(
      "Já existe um veículo com essa placa nesta empresa."
    );
  });

  it("erro NÃO-duplicado → null (deixa o formatter usar msg genérica)", () => {
    expect(friendlyDbErrorMessage(new Error("connection timeout"))).toBeNull();
    expect(friendlyDbErrorMessage(null)).toBeNull();
    expect(friendlyDbErrorMessage(undefined)).toBeNull();
  });
});
