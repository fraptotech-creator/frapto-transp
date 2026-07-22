import { describe, expect, it } from "vitest";
import {
  urlAppMotorista,
  mensagemAcessoMotorista,
} from "../client/src/lib/driverAccess";

describe("urlAppMotorista", () => {
  it("monta o endereço a partir da origem atual", () => {
    expect(urlAppMotorista("https://www.fraptotransp.com.br")).toBe(
      "https://www.fraptotransp.com.br/motorista"
    );
  });

  it("não duplica a barra quando a origem termina com /", () => {
    expect(urlAppMotorista("https://x.com/")).toBe("https://x.com/motorista");
    expect(urlAppMotorista("https://x.com///")).toBe("https://x.com/motorista");
  });
});

describe("mensagemAcessoMotorista", () => {
  const msg = mensagemAcessoMotorista({
    url: "https://x.com/motorista",
    usuario: "joao",
    senha: "a1b2c3d4",
  });

  it("traz endereço, usuário e senha — os três são necessários", () => {
    // Sem QUALQUER um deles o motorista não consegue entrar: o endereço
    // porque a rota dele é separada, e as credenciais porque o login é por
    // usuário, não por e-mail.
    expect(msg).toContain("https://x.com/motorista");
    expect(msg).toContain("joao");
    expect(msg).toContain("a1b2c3d4");
  });

  it("avisa da troca de senha no primeiro acesso", () => {
    expect(msg.toLowerCase()).toContain("primeiro acesso");
  });
});
