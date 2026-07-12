import { Button } from "@/components/ui/button";
import AuthScreen from "@/components/AuthScreen";
import {
  Truck,
  Users,
  MapPin,
  Wrench,
  DollarSign,
  BarChart3,
  Sparkles,
  Check,
  ShieldCheck,
  Navigation,
  Smartphone,
  Bell,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { useState } from "react";

type AuthMode = "login" | "signup";

const FEATURES = [
  {
    icon: Truck,
    title: "Frota completa",
    desc: "Veículos, status, quilometragem e documentos — tudo num lugar.",
  },
  {
    icon: Users,
    title: "Motoristas",
    desc: "CNH, categorias, disponibilidade e vencimentos sob controle.",
  },
  {
    icon: MapPin,
    title: "Viagens",
    desc: "Planeje rotas e cargas, com partida, chegada e histórico.",
  },
  {
    icon: Wrench,
    title: "Manutenção & óleo",
    desc: "Alertas de revisão e de troca de óleo por quilometragem.",
  },
  {
    icon: DollarSign,
    title: "Financeiro",
    desc: "Receitas, despesas por veículo e o saldo real da operação.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    desc: "Painel, gráficos e exportação em CSV e PDF quando precisar.",
  },
];

const HIGHLIGHTS = [
  {
    icon: Smartphone,
    title: "App do motorista",
    desc: "Cada motorista acessa só as viagens dele, inicia e conclui a corrida e registra a chegada — sem ver valores. Com botão de navegação no Waze.",
    accent: "from-blue-500 to-cyan-500",
  },
  {
    icon: Sparkles,
    title: "Assistente de IA",
    desc: 'Pergunte em português: "quanto gastei com o caminhão ABC?", "quais CNHs vencem?" — ele consulta seus dados e responde na hora.',
    accent: "from-purple-500 to-fuchsia-500",
  },
  {
    icon: Navigation,
    title: "Mapa e rota inclusos",
    desc: "Rota traçada no mapa e navegação real pelo Waze/Google — sem custo extra, sem configurar nada.",
    accent: "from-emerald-500 to-teal-500",
  },
];

const PLAN_FEATURES = [
  "Veículos, motoristas e viagens ilimitados",
  "App exclusivo do motorista",
  "Assistente de IA da frota",
  "Alertas de CNH, CRLV e troca de óleo",
  "Financeiro, relatórios e exportação CSV/PDF",
  "Mapa e navegação (Waze/Google) inclusos",
  "Dados isolados e seguros por empresa",
];

export default function Landing() {
  const [auth, setAuth] = useState<AuthMode | null>(null);

  if (auth) {
    return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Brilhos de fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative">
        {/* Nav */}
        <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-primary to-purple-600 p-2 shadow-lg shadow-primary/30">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">Frapto Transp</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setAuth("login")}>
                Entrar
              </Button>
              <Button
                onClick={() => setAuth("signup")}
                className="shadow-lg shadow-primary/30"
              >
                Começar
              </Button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> App do motorista + Assistente
            de IA inclusos
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl bg-gradient-to-br from-white via-white to-slate-500 bg-clip-text text-4xl font-extrabold leading-[1.1] text-transparent sm:text-6xl">
            A sua transportadora inteira
            <br className="hidden sm:block" /> na palma da mão
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Veículos, motoristas, viagens, manutenção e financeiro — com alertas
            de documentos vencendo, app pro motorista e uma IA que entende a sua
            operação. Simples, completo e seguro.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => setAuth("signup")}
              className="group h-12 px-7 text-base shadow-xl shadow-primary/30"
            >
              Começar agora — R$ 57/mês
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setAuth("login")}
              className="h-12 px-7 text-base"
            >
              Já tenho conta
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Cadastro em 1 minuto • Cancele quando quiser • Pagamento seguro
          </p>

          {/* Prévia do produto (mock) */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: Truck,
                  label: "Veículos ativos",
                  value: "24",
                  tone: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  icon: MapPin,
                  label: "Viagens no mês",
                  value: "138",
                  tone: "text-blue-400",
                  bg: "bg-blue-500/10",
                },
                {
                  icon: DollarSign,
                  label: "Saldo",
                  value: "R$ 82k",
                  tone: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  icon: Bell,
                  label: "Alertas",
                  value: "3",
                  tone: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur"
                  >
                    <div
                      className={`mb-3 w-fit rounded-lg p-2 ${s.bg} ${s.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
                    <p className="text-[11px] text-slate-500">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Destaques (diferenciais) */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-5 md:grid-cols-3">
            {HIGHLIGHTS.map(h => {
              const Icon = h.icon;
              return (
                <div
                  key={h.title}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                >
                  <div
                    className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${h.accent} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`}
                  />
                  <div
                    className={`mb-5 w-fit rounded-2xl bg-gradient-to-br ${h.accent} p-3 shadow-lg`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{h.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {h.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Tudo o que a operação precisa
            </h2>
            <p className="mt-3 text-slate-400">
              Do cadastro do veículo ao fechamento do mês — num sistema só.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.07]"
                >
                  <div className="mb-4 w-fit rounded-xl bg-primary/15 p-3 text-primary transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-1 font-semibold">{f.title}</h3>
                  <p className="text-sm text-slate-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-md px-6 py-20">
          <div className="relative rounded-3xl border border-primary/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl shadow-primary/10">
            <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-b from-primary/30 to-transparent blur-sm" />
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              Plano único • tudo incluído
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-6xl font-extrabold">R$ 57</span>
              <span className="text-slate-400">/mês</span>
            </div>
            <p className="mt-2 text-center text-sm text-slate-500">
              Por empresa. Sem limite de veículos ou motoristas.
            </p>
            <ul className="mt-7 space-y-3">
              {PLAN_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 rounded-full bg-emerald-500/15 p-0.5">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="mt-8 h-12 w-full text-base shadow-lg shadow-primary/30"
              onClick={() => setAuth("signup")}
            >
              Criar conta e assinar
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro via
              Stripe
            </p>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-purple-600/10 to-slate-950 p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <Gauge className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">
              Pare de controlar a frota no caderno e no WhatsApp
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Coloque veículos, motoristas e finanças num sistema profissional
              hoje mesmo.
            </p>
            <Button
              size="lg"
              onClick={() => setAuth("signup")}
              className="group mt-8 h-12 px-8 text-base shadow-xl shadow-primary/30"
            >
              Começar agora
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </section>

        <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
          <div className="mx-auto mb-2 flex w-fit items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary to-purple-600 p-1.5">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-300">Frapto Transp</span>
          </div>
          Gestão de Frotas • {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
