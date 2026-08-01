import { describe, it, expect } from "vitest";
import { toSafeLogError } from "./_core/safeLog";

// Sentinelas: se QUALQUER uma vazar no objeto logado, o teste falha.
const CPF = "12345678900";
const EMAIL = "vitima@exemplo.com";
const TOKEN = "a".repeat(48);
const APIKEY = "sk_live_supersecreta";
const DBURI = "mysql://user:senha@host:3306/db";

const contemSentinela = (o: unknown): boolean => {
  const s = JSON.stringify(o);
  return [CPF, EMAIL, TOKEN, APIKEY, DBURI, "senha", "SELECT", "INSERT"].some(
    x => s.includes(x)
  );
};

describe("toSafeLogError — nunca vaza PII/SQL/segredo", () => {
  it("erro do Drizzle com SQL+params (no message e no cause) não vaza nada", () => {
    // Simula o que o Drizzle produz: message com o SQL/valores + cause (driver).
    const driverErr = Object.assign(
      new Error(`Duplicate entry '${CPF}' for key 'cpf'`),
      { code: "ER_DUP_ENTRY", errno: 1062, sql: `INSERT ... '${CPF}'` }
    );
    const drizzleErr = Object.assign(
      new Error(`Failed query: insert ... params: ${CPF},${EMAIL}`),
      { name: "DrizzleQueryError", cause: driverErr }
    );
    const safe = toSafeLogError(drizzleErr);
    expect(contemSentinela(safe)).toBe(false);
    // Mas ainda identifica o erro para diagnóstico:
    expect(safe.name).toBe("DrizzleQueryError");
    expect(safe.code).toBe("ER_DUP_ENTRY"); // herdado do cause
    expect(safe.errno).toBe(1062);
  });

  it("erro de conexão com a URI do banco não vaza a credencial", () => {
    const connErr = Object.assign(new Error(`connect ECONNREFUSED ${DBURI}`), {
      code: "ECONNREFUSED",
    });
    const safe = toSafeLogError(connErr);
    expect(contemSentinela(safe)).toBe(false);
    expect(safe.code).toBe("ECONNREFUSED");
  });

  it("erro com apiKey/token no message não vaza", () => {
    const e = new Error(`request failed with key ${APIKEY} token ${TOKEN}`);
    expect(contemSentinela(toSafeLogError(e))).toBe(false);
  });

  it("descarta código não-simbólico (poderia ser valor)", () => {
    const e = Object.assign(new Error("x"), { code: `dup '${CPF}'` });
    const safe = toSafeLogError(e);
    expect(safe.code).toBeUndefined();
    expect(contemSentinela(safe)).toBe(false);
  });

  it("lida com null/undefined/primitivos", () => {
    expect(toSafeLogError(null)).toEqual({ name: "null" });
    expect(toSafeLogError(undefined)).toEqual({ name: "null" });
    expect(toSafeLogError("texto secreto")).toEqual({ name: "string" });
    expect(toSafeLogError(42)).toEqual({ name: "number" });
  });
});
