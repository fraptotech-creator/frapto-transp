import { describe, expect, it } from "vitest";
import {
  urlAppMotorista,
  linkAtivacao,
  mensagemAtivacao,
  linkWhatsApp,
  mensagemApp,
  alvoWhatsApp,
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

  it("explica que depois é só instalar o app (um link só)", () => {
    expect(msg).toContain("Instalar o app");
    expect(msg.match(/https?:\/\//g)).toHaveLength(1);
  });
});

describe("mensagemApp (motorista que já tem senha)", () => {
  it("leva o link do app e o passo de instalar", () => {
    const msg = mensagemApp("https://x.com/motorista");
    expect(msg).toContain("https://x.com/motorista");
    expect(msg).toContain("Instalar o app");
    expect(msg.toLowerCase()).not.toContain("senha:");
  });
});

describe("linkWhatsApp", () => {
  const m = "Olá & bem-vindo";
  const texto = `text=${encodeURIComponent(m)}`;

  it("celular com DDD (11 dígitos, com máscara) ganha o 55", () => {
    expect(linkWhatsApp("(27) 99867-1234", m)).toBe(
      `https://wa.me/5527998671234?${texto}`
    );
  });

  it("fixo com DDD (10 dígitos) também", () => {
    expect(linkWhatsApp("2733334444", m)).toBe(
      `https://wa.me/552733334444?${texto}`
    );
  });

  it("número que já vem com 55 não duplica", () => {
    expect(linkWhatsApp("+55 27 99867-1234", m)).toBe(
      `https://wa.me/5527998671234?${texto}`
    );
  });

  it("sem telefone ou inválido → WhatsApp sem número (gestor escolhe)", () => {
    expect(linkWhatsApp(null, m)).toBe(`https://wa.me/?${texto}`);
    expect(linkWhatsApp("123", m)).toBe(`https://wa.me/?${texto}`);
  });

  it("a mensagem vai codificada (& e espaço não quebram o link)", () => {
    expect(linkWhatsApp(null, m)).not.toContain("& bem");
  });

  // Pedido do dono (24/11/2026): no computador o wa.me abria o app de
  // desktop do WhatsApp — agora vai direto para o WhatsApp Web.
  it("no computador abre o WhatsApp Web na conversa do motorista", () => {
    expect(linkWhatsApp("(27) 99867-1234", m, true)).toBe(
      `https://web.whatsapp.com/send?phone=5527998671234&${texto}`
    );
    expect(linkWhatsApp(null, m, true)).toBe(
      `https://web.whatsapp.com/send?${texto}`
    );
  });
});

describe("alvoWhatsApp", () => {
  it("computador: aba com nome fixo (reaproveita o WhatsApp Web aberto)", () => {
    expect(alvoWhatsApp(true)).toEqual({ target: "frapto-whatsapp" });
  });
  it("celular: _blank isolado", () => {
    expect(alvoWhatsApp(false)).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});
