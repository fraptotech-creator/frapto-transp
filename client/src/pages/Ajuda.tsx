import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, LifeBuoy, Mail, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { EMPRESA } from "@/lib/empresa";
import { Rodape } from "@/components/landing/SecoesFim";
import {
  MODULOS,
  filtrarModulos,
  type ModuloId,
} from "@/components/ajuda/conteudo";
import {
  ICONE_MODULO,
  MenuFaixa,
  MenuLateral,
} from "@/components/ajuda/MenuAjuda";
import { TopicoAjuda } from "@/components/ajuda/TopicoAjuda";

const ASSUNTO_SUPORTE = "Suporte Frapto Transp";

// Central de Ajuda (/ajuda): PÚBLICA, aberta pelo link "Suporte" da página de
// vendas. E-mail do suporte + vídeos de cada função, organizados por módulo,
// com menu e busca para o cliente chegar direto no que precisa.
export default function Ajuda() {
  const [busca, setBusca] = useState("");
  const modulos = useMemo(() => filtrarModulos(MODULOS, busca), [busca]);
  const [ativo, setAtivo] = useState<ModuloId | null>(MODULOS[0].id);

  // Marca no menu o módulo que está na tela.
  useEffect(() => {
    const obs = new IntersectionObserver(
      entradas => {
        const visivel = entradas.find(e => e.isIntersecting);
        if (visivel) setAtivo(visivel.target.id as ModuloId);
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    document
      .querySelectorAll("section[data-modulo]")
      .forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [modulos]);

  // Link direto para uma função (/ajuda#topico-x): rola até ela ao abrir.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    // overflow-x-CLIP (não hidden): hidden vira contêiner de rolagem e o
    // topo/menu "sticky" deixariam de ficar presos ao rolar a página.
    <div className="relative min-h-screen overflow-x-clip bg-slate-950 text-slate-100 [scroll-behavior:smooth]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="relative">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <a href="/" className="flex items-center gap-2">
              <span className="rounded-xl bg-gradient-to-br from-primary to-purple-600 p-2 shadow-lg shadow-primary/30">
                <Truck className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-bold">Frapto Transp</span>
            </a>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="/"
                className="hidden items-center gap-1 text-slate-400 hover:text-white sm:flex"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao site
              </a>
              <a
                href="/login"
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white shadow-lg shadow-primary/30 hover:bg-primary/90"
              >
                Entrar
              </a>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-8 pt-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <LifeBuoy className="h-3.5 w-3.5" /> Suporte
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Central de Ajuda
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-400">
              Vídeos curtos, gravados no próprio sistema, mostrando como usar
              cada função. Escolha o módulo no menu ou busque pelo que precisa.
            </p>
            <label className="relative mt-6 block max-w-xl">
              <span className="sr-only">Buscar na ajuda</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Ex.: cadastrar motorista, rastrear, CNH"
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-900/80 pl-12 pr-4 text-base text-white placeholder:text-slate-500 focus:border-primary/60 focus:outline-none"
              />
            </label>
          </div>
          <CartaoSuporte />
        </section>

        <div className="sticky top-[57px] z-10 border-b border-white/5 bg-slate-950/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <MenuFaixa modulos={modulos} ativo={ativo} />
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Módulos
              </p>
              <MenuLateral modulos={modulos} ativo={ativo} />
            </div>
          </aside>

          <main className="min-w-0 space-y-14">
            {modulos.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-400">
                Nada encontrado para “{busca}”. Tente outra palavra ou escreva
                para{" "}
                <a
                  href={`mailto:${EMPRESA.email}`}
                  className="text-primary hover:underline"
                >
                  {EMPRESA.email}
                </a>
                .
              </div>
            )}
            {modulos.map(m => {
              const Icone = ICONE_MODULO[m.id];
              return (
                <section
                  key={m.id}
                  id={m.id}
                  data-modulo
                  className="scroll-mt-36 space-y-5 lg:scroll-mt-24"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-primary/15 p-2.5">
                      <Icone className="h-5 w-5 text-primary" />
                    </span>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {m.titulo}
                      </h2>
                      <p className="text-sm text-slate-400">{m.descricao}</p>
                    </div>
                  </div>
                  {m.topicos.map(t => (
                    <TopicoAjuda key={t.id} topico={t} />
                  ))}
                </section>
              );
            })}
          </main>
        </div>

        <Rodape />
      </div>
    </div>
  );
}

function CartaoSuporte() {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(EMPRESA.email);
      toast.success("E-mail copiado!");
    } catch (e) {
      // Navegador sem permissão de área de transferência: o e-mail segue na tela.
      console.warn("[ajuda] não deu para copiar o e-mail", e);
      toast.error("Não deu para copiar. Selecione o e-mail na tela.");
    }
  };
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-purple-600/10 p-6">
      <div className="flex items-center gap-2 font-semibold text-white">
        <Mail className="h-5 w-5 text-primary" /> Fale com o suporte
      </div>
      <p className="mt-2 text-sm text-slate-300">
        Não achou o que precisa? Escreva para nós com o nome da sua empresa e a
        sua dúvida.
      </p>
      <a
        href={`mailto:${EMPRESA.email}?subject=${encodeURIComponent(ASSUNTO_SUPORTE)}`}
        className="mt-4 block break-all rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary/90"
      >
        {EMPRESA.email}
      </a>
      <button
        type="button"
        onClick={copiar}
        className="mx-auto mt-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <Copy className="h-4 w-4" /> Copiar e-mail
      </button>
    </div>
  );
}
