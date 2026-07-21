import { describe, expect, it } from "vitest";
import { isSuperAdmin } from "./_core/superAdmin";

const CFG = { openId: "local_abc123", email: "fraptotech@gmail.com" };
const ADMIN = { openId: "local_abc123", email: "fraptotech@gmail.com" };

describe("isSuperAdmin (fail-closed)", () => {
  it("aceita só quem bate openId E email", () => {
    expect(isSuperAdmin(ADMIN, CFG)).toBe(true);
    expect(isSuperAdmin({ ...ADMIN, email: "FRAPTOTECH@GMAIL.COM" }, CFG)).toBe(
      true
    ); // case-insensitive no email
  });

  it("NEGA se o openId não bate (mesmo com o email certo)", () => {
    // Cenário do ataque: alguém cadastra o email do admin.
    expect(
      isSuperAdmin({ openId: "local_atacante", email: CFG.email }, CFG)
    ).toBe(false);
  });

  it("NEGA se o email não bate (mesmo com openId certo)", () => {
    expect(
      isSuperAdmin({ openId: CFG.openId, email: "outro@x.com" }, CFG)
    ).toBe(false);
  });

  it("NEGA quando a env não está setada (fail-closed)", () => {
    expect(isSuperAdmin(ADMIN, { openId: "", email: "" })).toBe(false);
    expect(isSuperAdmin(ADMIN, { openId: CFG.openId, email: "" })).toBe(false);
    expect(isSuperAdmin(ADMIN, { openId: "", email: CFG.email })).toBe(false);
  });

  it("NEGA usuário sem identidade / nulo", () => {
    expect(isSuperAdmin(null, CFG)).toBe(false);
    expect(isSuperAdmin(undefined, CFG)).toBe(false);
    expect(isSuperAdmin({ openId: null, email: null }, CFG)).toBe(false);
    expect(isSuperAdmin({ openId: CFG.openId, email: null }, CFG)).toBe(false);
  });
});
