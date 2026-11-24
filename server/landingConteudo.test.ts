import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DESTAQUES,
  DORES,
  FAQ,
  FATOS,
  PASSOS,
  PLANO_INCLUI,
  PRECO_MENSAL,
  PRECO_POR_DIA_TEXTO,
  PRECO_TEXTO,
  RECURSOS,
} from "../client/src/components/landing/conteudo";

// Página de vendas (24/11/2026): o texto só pode prometer o que o sistema faz
// e o preço tem de bater com o resto do produto.
const raiz = path.resolve(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const todoTexto = [
  ...DORES.flatMap(d => [d.pergunta, d.resposta]),
  ...DESTAQUES.flatMap(d => [d.titulo, d.texto, ...d.pontos]),
  ...RECURSOS.flatMap(r => [r.titulo, r.texto]),
  ...PASSOS.flatMap(p => [p.titulo, p.texto]),
  ...PLANO_INCLUI,
  ...FATOS,
].join("\n");

describe("conteúdo da página de vendas", () => {
  it("preço igual ao do paywall, dos Termos e do rótulo do servidor", () => {
    expect(PRECO_TEXTO).toBe(`R$ ${PRECO_MENSAL}`);
    expect(ler("client/src/components/Paywall.tsx")).toContain(PRECO_TEXTO);
    expect(ler("client/src/pages/Termos.tsx")).toContain(
      `R$ ${PRECO_MENSAL},00 por mês`
    );
    expect(ler("server/routers/account.ts")).toContain(
      `R$ ${PRECO_MENSAL},00/mês`
    );
  });

  it("'menos de R$ 2 por dia' é verdade (preço / 30)", () => {
    expect(PRECO_POR_DIA_TEXTO).toBe("menos de R$ 2 por dia");
    expect(PRECO_MENSAL / 30).toBeLessThan(2);
  });

  it("não promete teste grátis (não existe) — só o FAQ explica que não há", () => {
    expect(todoTexto).not.toMatch(/gr[aá]tis/i);
    const faqGratis = FAQ.filter(f => /gr[aá]tis/i.test(f.p + f.r));
    expect(faqGratis).toHaveLength(1);
    expect(faqGratis[0].r).toMatch(/^Não há teste grátis/);
  });

  it("não inventa prova social (clientes, avaliações, percentuais)", () => {
    expect(todoTexto).not.toMatch(/\d+\s*%|\bclientes?\b|avalia[cç]/i);
  });

  it("rastreamento descrito como só durante a viagem (Política de Privacidade)", () => {
    const mapa = DESTAQUES.find(d => d.id === "mapa");
    expect(mapa?.pontos.join(" ")).toMatch(/Só registra durante a viagem/);
  });
});
