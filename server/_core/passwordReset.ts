import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Recuperação de senha. As decisões ficam aqui, puras e testáveis; o efeito
// (banco, e-mail) fica na borda, no router.

export const VALIDADE_MS = 60 * 60 * 1000; // 1 hora

/**
 * Gera o par (token que vai no e-mail, hash que vai no banco).
 *
 * Só o hash é persistido. Se o banco vazar, os tokens não são utilizáveis —
 * mesma lógica de senha com bcrypt, aplicada ao link de recuperação.
 */
export function gerarTokenReset(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compara em tempo CONSTANTE. Comparação com === vaza, pelo tempo de resposta,
 * quantos caracteres iniciais o atacante acertou — o que permite descobrir o
 * token byte a byte.
 */
export function tokenConfere(tokenRecebido: string, hashGuardado: string) {
  const a = Buffer.from(hashToken(tokenRecebido), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type MotivoRecusa = "sem-token" | "expirado" | "nao-confere";

export type DecisaoReset = { ok: true } | { ok: false; motivo: MotivoRecusa };

/**
 * Fail-closed: qualquer dúvida NEGA. A resposta ao usuário é sempre a mesma
 * mensagem genérica — o `motivo` serve só para log, nunca para a tela, senão
 * vira oráculo para descobrir e-mails cadastrados ou tokens válidos.
 */
export function podeRedefinir(params: {
  hashGuardado: string | null | undefined;
  expiraEm: Date | null | undefined;
  tokenRecebido: string;
  agora: Date;
}): DecisaoReset {
  if (!params.hashGuardado || !params.expiraEm) {
    return { ok: false, motivo: "sem-token" };
  }
  if (params.agora.getTime() >= params.expiraEm.getTime()) {
    return { ok: false, motivo: "expirado" };
  }
  if (!tokenConfere(params.tokenRecebido, params.hashGuardado)) {
    return { ok: false, motivo: "nao-confere" };
  }
  return { ok: true };
}

export function expiraEm(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_MS);
}

// URL que vai no e-mail. O token viaja na querystring porque precisa chegar
// ao browser do usuário; é de uso único e curta duração para limitar o dano
// de ficar no histórico do navegador.
export function linkReset(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/redefinir-senha?token=${token}`;
}
