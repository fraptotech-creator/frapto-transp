import { describe, expect, it } from "vitest";
import {
  gerarTokenReset,
  hashToken,
  tokenConfere,
  podeRedefinir,
  expiraEm,
  linkReset,
  VALIDADE_MS,
} from "./_core/passwordReset";

describe("gerarTokenReset", () => {
  it("o token NÃO é o que fica guardado", () => {
    // A propriedade que protege o banco: mesmo lendo a coluna, não dá para
    // montar o link de recuperação.
    const { token, hash } = gerarTokenReset();
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashToken(token));
  });

  it("gera token novo a cada chamada", () => {
    const a = gerarTokenReset();
    const b = gerarTokenReset();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it("token tem entropia suficiente (32 bytes em hex)", () => {
    expect(gerarTokenReset().token).toHaveLength(64);
  });
});

describe("tokenConfere", () => {
  it("aceita o token certo e recusa o errado", () => {
    const { token, hash } = gerarTokenReset();
    expect(tokenConfere(token, hash)).toBe(true);
    expect(tokenConfere(gerarTokenReset().token, hash)).toBe(false);
  });

  it("não estoura com hash de tamanho inválido", () => {
    expect(tokenConfere("abc", "naoehex")).toBe(false);
    expect(tokenConfere("abc", "")).toBe(false);
  });
});

describe("podeRedefinir", () => {
  const agora = new Date("2026-07-22T00:00:00Z");
  const { token, hash } = gerarTokenReset();
  const futuro = new Date(agora.getTime() + 1000);

  it("aceita token válido dentro do prazo", () => {
    expect(
      podeRedefinir({
        hashGuardado: hash,
        expiraEm: futuro,
        tokenRecebido: token,
        agora,
      })
    ).toEqual({ ok: true });
  });

  it("NEGA quem nunca pediu recuperação", () => {
    expect(
      podeRedefinir({
        hashGuardado: null,
        expiraEm: null,
        tokenRecebido: token,
        agora,
      })
    ).toEqual({ ok: false, motivo: "sem-token" });
  });

  it("NEGA token expirado — inclusive no instante exato do vencimento", () => {
    expect(
      podeRedefinir({
        hashGuardado: hash,
        expiraEm: agora,
        tokenRecebido: token,
        agora,
      })
    ).toEqual({ ok: false, motivo: "expirado" });
  });

  it("NEGA token de outra pessoa", () => {
    expect(
      podeRedefinir({
        hashGuardado: hash,
        expiraEm: futuro,
        tokenRecebido: gerarTokenReset().token,
        agora,
      })
    ).toEqual({ ok: false, motivo: "nao-confere" });
  });

  it("expira em 1 hora", () => {
    expect(expiraEm(agora).getTime() - agora.getTime()).toBe(VALIDADE_MS);
    expect(VALIDADE_MS).toBe(60 * 60 * 1000);
  });
});

describe("linkReset", () => {
  it("monta o link sem barra dupla", () => {
    expect(linkReset("https://x.com/", "abc")).toBe(
      "https://x.com/redefinir-senha?token=abc"
    );
    expect(linkReset("https://x.com", "abc")).toBe(
      "https://x.com/redefinir-senha?token=abc"
    );
  });
});
