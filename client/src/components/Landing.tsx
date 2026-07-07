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
} from "lucide-react";
import { useState } from "react";

type AuthMode = "login" | "signup";

const FEATURES = [
  {
    icon: Truck,
    title: "Frota completa",
    desc: "Cadastre veículos, acompanhe status, quilometragem e documentos.",
  },
  {
    icon: Users,
    title: "Motoristas",
    desc: "Controle CNH, categorias, disponibilidade e vencimentos.",
  },
  {
    icon: MapPin,
    title: "Viagens",
    desc: "Planeje rotas, cargas e acompanhe cada viagem da operação.",
  },
  {
    icon: Wrench,
    title: "Manutenção",
    desc: "Agende revisões e receba alertas do que está pra vencer.",
  },
  {
    icon: DollarSign,
    title: "Financeiro",
    desc: "Receitas, despesas e o saldo da operação num só lugar.",
  },
  {
    icon: Sparkles,
    title: "Assistente de IA",
    desc: "Pergunte em linguagem natural sobre a sua frota e receba respostas.",
  },
];

const PLAN_FEATURES = [
  "Veículos, motoristas e viagens ilimitados",
  "Alertas de CNH e CRLV vencendo",
  "Controle financeiro completo",
  "Relatórios e painel de controle",
  "Assistente de IA da frota",
  "Dados isolados e seguros por empresa",
];

export default function Landing() {
  const [auth, setAuth] = useState<AuthMode | null>(null);

  if (auth) {
    return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gradient-to-br from-primary to-purple-600 p-2 shadow-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">Frapto Transp</span>
        </div>
        <Button variant="ghost" onClick={() => setAuth("login")}>
          Entrar
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center sm:pt-16">
        <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
          Gestão de frotas simples e completa
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-4xl font-bold leading-tight text-transparent sm:text-5xl">
          Controle toda a sua frota em um só lugar
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          Veículos, motoristas, viagens, manutenção e financeiro — com alertas
          de documentos vencendo e um assistente de IA que entende a sua
          operação.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => setAuth("signup")}>
            Começar agora — R$ 57/mês
          </Button>
          <Button size="lg" variant="outline" onClick={() => setAuth("login")}>
            Já tenho conta
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="mb-4 w-fit rounded-xl bg-primary/15 p-3 text-primary">
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
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-slate-900 to-slate-900/40 p-8 shadow-2xl">
          <h2 className="text-center text-lg font-semibold text-slate-300">
            Plano único
          </h2>
          <div className="mt-3 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold">R$ 57</span>
            <span className="text-slate-400">/mês</span>
          </div>
          <ul className="mt-6 space-y-3">
            {PLAN_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            className="mt-8 w-full"
            onClick={() => setAuth("signup")}
          >
            Criar conta e assinar
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro via Stripe
          </p>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
        <BarChart3 className="mx-auto mb-2 h-5 w-5 opacity-40" />
        Frapto Transp — Gestão de Frotas
      </footer>
    </div>
  );
}
