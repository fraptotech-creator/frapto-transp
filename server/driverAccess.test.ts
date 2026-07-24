import { describe, expect, it } from "vitest";
import {
  urlAppMotorista,
  linkAtivacao,
  mensagemAtivacao,
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

describe("linkAtivacao", () => {
  it("aponta para /redefinir-senha com token e next=/motorista", () => {
    const link = linkAtivacao("https://x.com", "abc123");
    expect(link).toBe(
      "https://x.com/redefinir-senha?token=abc123&next=/motorista"
    );
  });

  it("escapa o token (uso único vindo do servidor)", () => {
    // Um token com caracteres especiais não pode quebrar a querystring.
    const link = linkAtivacao("https://x.com/", "a b&c=d");
    expect(link).toContain("token=a%20b%26c%3Dd");
    expect(link).not.toContain("token=a b&c=d");
  });
});

describe("mensagemAtivacao", () => {
  const msg = mensagemAtivacao({
    usuario: "joao",
    link: "https://x.com/redefinir-senha?token=abc123&next=/motorista",
  });

  it("traz usuário e o LINK de ativação", () => {
    expect(msg).toContain("joao");
    expect(msg).toContain(
      "https://x.com/redefinir-senha?token=abc123&next=/motorista"
    );
  });

  it("NÃO envia senha em texto — essa é a correção (P1 #5)", () => {
    // Trava anti-regressão: nenhuma senha pode voltar a trafegar na mensagem.
    // Antes a mensagem continha uma "senha inicial" em texto puro; agora é só
    // o link de uso único, e o motorista cria a própria senha.
    expect(msg.toLowerCase()).not.toContain("senha inicial");
    expect(msg.toLowerCase()).toContain("crie sua senha");
    expect(msg.toLowerCase()).toContain("uso único");
  });
});
