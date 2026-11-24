import { ArrowRight, Check, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESTAQUES, DORES, FATOS, PRECO_TEXTO } from "./conteudo";
import {
  IlustracaoDestaque,
  Janela,
  ListaAlertas,
  MapaAoVivo,
  SeloExemplo,
} from "./Ilustracoes";

export type Acoes = { assinar: () => void; entrar: () => void };

const LINKS = [
  ["Recursos", "#recursos"],
  ["Como funciona", "#como-funciona"],
  ["Preço", "#preco"],
  ["Dúvidas", "#duvidas"],
] as const;

export function Topo({ assinar, entrar }: Acoes) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#inicio" className="flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-br from-primary to-purple-600 p-2 shadow-lg shadow-primary/30">
            <Truck className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold">Frapto Transp</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          {LINKS.map(([rotulo, href]) => (
            <a key={href} href={href} className="hover:text-white">
              {rotulo}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={entrar}>
            Entrar
          </Button>
          <Button onClick={assinar} className="shadow-lg shadow-primary/30">
            Assinar
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Hero({ assinar }: Acoes) {
  return (
    <section
      id="inicio"
      className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20"
    >
      <div className="text-center lg:text-left">
        <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          Gestão de frota para vans, ônibus e caminhões
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
          Saiba onde está cada viagem, quanto ela rendeu e o que vai vencer.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400 lg:mx-0">
          Veículos, motoristas, viagens, manutenção e financeiro num sistema só
          — com a viagem no mapa ao vivo, alertas de documento e troca de óleo e
          um app simples para o motorista.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <Button
            size="lg"
            onClick={assinar}
            className="group h-12 w-full px-7 text-base shadow-xl shadow-primary/30 sm:w-auto"
          >
            Assinar por {PRECO_TEXTO}/mês
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          {/* Link estilizado à mão: o variant "outline" do Button tem regras
              dark: que ganham do className e o deixavam sem borda aqui. */}
          <a
            href="#recursos"
            className="inline-flex h-12 w-full items-center justify-center rounded-md border border-white/20 bg-white/5 px-7 text-base font-medium text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            Ver como funciona
          </a>
        </div>
      </div>
      <div>
        <Janela titulo="Painel · Frapto Transp">
          <MapaAoVivo compacto />
          <div className="border-t border-white/10">
            <ListaAlertas />
          </div>
        </Janela>
        <SeloExemplo />
      </div>
    </section>
  );
}

export function FaixaFatos() {
  return (
    <div className="border-y border-white/5 bg-white/[0.02]">
      <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-3 px-4 py-5 text-sm text-slate-300 sm:px-6">
        {FATOS.map(f => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dores() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          As perguntas do dia a dia, respondidas na tela
        </h2>
        <p className="mt-3 text-slate-400">
          Chega de caderno, planilha e mensagem perdida no WhatsApp.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {DORES.map(d => (
          <div
            key={d.pergunta}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/15 p-2.5 text-primary">
                <d.icon className="h-5 w-5" />
              </span>
              <p className="text-lg font-semibold text-white">“{d.pergunta}”</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {d.resposta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Destaques() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-4 sm:px-6">
      {DESTAQUES.map((d, i) => (
        <div
          key={d.id}
          className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16"
        >
          <div className={i % 2 === 1 ? "lg:order-2" : ""}>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              {d.selo}
            </span>
            <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {d.titulo}
            </h3>
            <p className="mt-4 leading-relaxed text-slate-400">{d.texto}</p>
            <ul className="mt-6 space-y-3">
              {d.pontos.map(p => (
                <li key={p} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 rounded-full bg-emerald-500/15 p-0.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </span>
                  <span className="text-slate-300">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={i % 2 === 1 ? "lg:order-1" : ""}>
            <IlustracaoDestaque id={d.id} />
            <SeloExemplo />
          </div>
        </div>
      ))}
    </section>
  );
}
