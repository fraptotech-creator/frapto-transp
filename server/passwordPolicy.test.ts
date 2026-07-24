import { describe, expect, it } from "vitest";
import {
  SENHA_MIN,
  senhaAtendeMinimo,
  exigeTrocaDeSenha,
} from "./_core/passwordPolicy";

describe("política de senha", () => {
  it("mínimo padronizado em 8 (era 6 na troca)", () => {
    expect(SENHA_MIN).toBe(8);
    expect(senhaAtendeMinimo("1234567")).toBe(false);
    expect(senhaAtendeMinimo("12345678")).toBe(true);
  });
});

describe("exigeTrocaDeSenha (bloqueio server-side)", () => {
  it("motorista com senha temporária é bloqueado", () => {
    // Este é o gate que faltava: sem ele, o motorista com senha temporária
    // acessava todo o driverApp.* mesmo sem trocar a senha.
    expect(exigeTrocaDeSenha({ mustChangePassword: true })).toBe(true);
  });

  it("após trocar (flag false) o acesso é liberado", () => {
    expect(exigeTrocaDeSenha({ mustChangePassword: false })).toBe(false);
  });

  it("usuário sem a flag / nulo não é travado", () => {
    expect(exigeTrocaDeSenha({})).toBe(false);
    expect(exigeTrocaDeSenha(null)).toBe(false);
    expect(exigeTrocaDeSenha(undefined)).toBe(false);
  });
});
