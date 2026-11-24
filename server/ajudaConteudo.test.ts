import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MODULOS,
  ancoraTopico,
  caminhoCapa,
  caminhoVideo,
  filtrarModulos,
} from "../client/src/components/ajuda/conteudo";

// Central de Ajuda (24/11/2026): todo vídeo citado precisa existir (senão o
// cliente vê um player quebrado) e todo arquivo da pasta precisa ser usado
// (senão é peso morto no site).
const raiz = path.resolve(__dirname, "..");
const publico = path.join(raiz, "client", "public");
const topicos = MODULOS.flatMap(m => m.topicos);

describe("conteúdo da Central de Ajuda", () => {
  it("ids de módulo e de função são únicos", () => {
    const ids = [
      ...MODULOS.map(m => m.id),
      ...topicos.map(t => ancoraTopico(t.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const idsTopico = topicos.map(t => t.id);
    expect(new Set(idsTopico).size).toBe(idsTopico.length);
  });

  it("toda função tem título, resumo e passo a passo", () => {
    for (const t of topicos) {
      expect(t.titulo.trim(), t.id).not.toBe("");
      expect(t.resumo.trim(), t.id).not.toBe("");
      expect(t.passos.length, t.id).toBeGreaterThan(0);
    }
    for (const m of MODULOS) expect(m.topicos.length, m.id).toBeGreaterThan(0);
  });

  it("todo vídeo citado existe, com a capa", () => {
    for (const t of topicos.filter(t => t.video)) {
      expect(fs.existsSync(path.join(publico, caminhoVideo(t.id))), t.id).toBe(
        true
      );
      expect(fs.existsSync(path.join(publico, caminhoCapa(t.id))), t.id).toBe(
        true
      );
    }
  });

  it("não há arquivo sobrando na pasta da ajuda", () => {
    const usados = new Set(
      topicos
        .filter(t => t.video)
        .flatMap(t =>
          [caminhoVideo(t.id), caminhoCapa(t.id)].map(c => path.basename(c))
        )
    );
    for (const arq of fs.readdirSync(path.join(publico, "ajuda"))) {
      expect(usados.has(arq), arq).toBe(true);
    }
  });

  it("os vídeos são leves (até 3 MB cada) para abrir rápido no celular", () => {
    for (const t of topicos.filter(t => t.video)) {
      const bytes = fs.statSync(path.join(publico, caminhoVideo(t.id))).size;
      expect(bytes, t.id).toBeLessThanOrEqual(3 * 1024 * 1024);
    }
  });
});

describe("busca da Central de Ajuda", () => {
  const titulos = (busca: string) =>
    filtrarModulos(MODULOS, busca).flatMap(m => m.topicos.map(t => t.id));

  it("sem busca mostra tudo", () => {
    expect(filtrarModulos(MODULOS, "  ")).toBe(MODULOS);
  });

  it("ignora acento e maiúscula", () => {
    expect(titulos("MANUTENCAO")).toContain("manutencao");
    expect(titulos("veiculo")).toContain("veiculo-cadastrar");
  });

  it("aceita várias palavras em qualquer ordem", () => {
    expect(titulos("motorista cadastrar")).toContain("motorista-cadastrar");
    expect(titulos("waze rota")).toContain("viagem-rastrear");
  });

  it("o nome do módulo também acha as funções dele", () => {
    expect(titulos("relatórios")).toEqual(["relatorios"]);
  });

  it("busca sem resultado devolve lista vazia", () => {
    expect(filtrarModulos(MODULOS, "xyzabc")).toEqual([]);
  });
});

describe("link de suporte na página de vendas", () => {
  const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

  it("topo, dúvidas e rodapé levam à Central de Ajuda", () => {
    expect(ler("client/src/components/landing/SecoesTopo.tsx")).toContain(
      '"/ajuda"'
    );
    const fim = ler("client/src/components/landing/SecoesFim.tsx");
    expect(fim.match(/href="\/ajuda"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("a rota /ajuda é pública (fora do painel logado)", () => {
    const app = ler("client/src/App.tsx");
    const rotaAjuda = app.indexOf('path="/ajuda"');
    expect(rotaAjuda).toBeGreaterThan(-1);
    expect(rotaAjuda).toBeLessThan(app.indexOf("<DashboardLayout>"));
  });
});
