import { ArrowRight, Check, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IDENTIFICACAO_EMPRESA, EMPRESA } from "@/lib/empresa";
import {
  CONFIANCA,
  FAQ,
  PASSOS,
  PLANO_INCLUI,
  PRECO_POR_DIA_TEXTO,
  PRECO_TEXTO,
  RECURSOS,
  SEGMENTOS,
} from "./conteudo";
import type { Acoes } from "./SecoesTopo";

export function ParaQuem() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-3xl font-bold sm:text-4xl">
        Feito para quem vive de transporte
      </h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {SEGMENTOS.map(s => (
          <div
            key={s.titulo}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center"
          >
            <s.icon className="mx-auto h-8 w-8 text-primary" />
            <h3 className="mt-3 font-semibold text-white">{s.titulo}</h3>
            <p className="mt-1 text-sm text-slate-400">{s.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TodosRecursos() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Tudo incluso, sem módulo extra
        </h2>
        <p className="mt-3 text-slate-400">
          Do cadastro do veículo ao fechamento do mês.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RECURSOS.map(r => (
          <div
            key={r.titulo}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <r.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold text-white">{r.titulo}</h3>
            <p className="mt-1 text-sm text-slate-400">{r.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
    >
      <h2 className="text-center text-3xl font-bold sm:text-4xl">
        Comece hoje, em 3 passos
      </h2>
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {PASSOS.map((p, i) => (
          <li
            key={p.titulo}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold text-white">{p.titulo}</h3>
            <p className="mt-2 text-sm text-slate-400">{p.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Preco({ assinar }: Acoes) {
  return (
    <section
      id="preco"
      className="mx-auto grid max-w-5xl scroll-mt-20 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2"
    >
      <div>
        <h2 className="text-3xl font-bold sm:text-4xl">
          Um preço só. Aberto, sem proposta e sem vendedor.
        </h2>
        <p className="mt-4 text-slate-400">
          {PRECO_TEXTO} por mês por empresa — {PRECO_POR_DIA_TEXTO}. Sem taxa de
          implantação, sem cobrança por veículo e sem fidelidade.
        </p>
        <ul className="mt-6 space-y-4">
          {CONFIANCA.map(c => (
            <li key={c.titulo} className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <span>
                <span className="font-semibold text-white">{c.titulo}.</span>{" "}
                <span className="text-sm text-slate-400">{c.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative rounded-3xl border border-primary/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl shadow-primary/10">
        <p className="mx-auto w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          Plano único · tudo incluído
        </p>
        <p className="mt-4 flex items-baseline justify-center gap-1">
          <span className="text-6xl font-extrabold text-white">
            {PRECO_TEXTO}
          </span>
          <span className="text-slate-400">/mês</span>
        </p>
        <ul className="mt-7 space-y-3">
          {PLANO_INCLUI.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-slate-200">{f}</span>
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          onClick={assinar}
          className="mt-8 h-12 w-full text-base shadow-lg shadow-primary/30"
        >
          Criar conta e assinar
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500">
          7 dias de arrependimento com reembolso integral · cancele online
        </p>
      </div>
    </section>
  );
}

export function Duvidas() {
  return (
    <section
      id="duvidas"
      className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6"
    >
      <h2 className="text-center text-3xl font-bold sm:text-4xl">
        Perguntas frequentes
      </h2>
      <Accordion type="single" collapsible className="mt-8">
        {FAQ.map(f => (
          <AccordionItem key={f.p} value={f.p} className="border-white/10">
            <AccordionTrigger className="text-left text-base text-white">
              {f.p}
            </AccordionTrigger>
            <AccordionContent className="text-slate-400">
              {f.r}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="mt-6 text-center text-sm text-slate-500">
        Quer ver como funciona? A{" "}
        <a href="/ajuda" className="text-primary hover:underline">
          Central de Ajuda
        </a>{" "}
        tem vídeos de cada função. Outra dúvida? Escreva para{" "}
        <a
          href={`mailto:${EMPRESA.email}`}
          className="text-primary hover:underline"
        >
          {EMPRESA.email}
        </a>
      </p>
    </section>
  );
}

export function ChamadaFinal({ assinar }: Acoes) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/25 via-purple-600/10 to-slate-950 p-10 text-center sm:p-14">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
          Tire a frota do caderno e do WhatsApp hoje
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Em poucos minutos a sua frota está cadastrada e a primeira viagem no
          mapa.
        </p>
        <Button
          size="lg"
          onClick={assinar}
          className="group mt-8 h-12 px-8 text-base shadow-xl shadow-primary/30"
        >
          Assinar por {PRECO_TEXTO}/mês
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
      <div className="mx-auto mb-2 flex w-fit items-center gap-2">
        <span className="rounded-lg bg-gradient-to-br from-primary to-purple-600 p-1.5">
          <Truck className="h-4 w-4 text-white" />
        </span>
        <span className="font-semibold text-slate-300">Frapto Transp</span>
      </div>
      Gestão de Frotas • {new Date().getFullYear()}
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
        <a href="/termos" className="hover:text-slate-300">
          Termos de Serviço
        </a>
        <a href="/privacidade" className="hover:text-slate-300">
          Política de Privacidade
        </a>
        <a href="/ajuda" className="hover:text-slate-300">
          Suporte
        </a>
        <a href={`mailto:${EMPRESA.email}`} className="hover:text-slate-300">
          Contato
        </a>
      </div>
      <p className="mx-auto mt-3 max-w-xl px-4 text-xs">
        {IDENTIFICACAO_EMPRESA}
      </p>
    </footer>
  );
}
