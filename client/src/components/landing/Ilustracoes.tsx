import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Navigation,
  Play,
  Wrench,
} from "lucide-react";
import type { Destaque } from "./conteudo";

// Ilustrações das telas do produto na página de vendas. São DESENHOS com dados
// de EXEMPLO (marcados como tal na tela) — não são números de clientes reais.

export function Janela({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate text-xs text-slate-400">{titulo}</span>
      </div>
      {children}
    </div>
  );
}

export function SeloExemplo() {
  return (
    <p className="mt-2 text-center text-[11px] text-slate-500">
      Ilustração com dados de exemplo
    </p>
  );
}

export function MapaAoVivo({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className={`relative ${compacto ? "h-40" : "h-64"} bg-slate-950`}>
      <svg
        viewBox="0 0 400 240"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <g stroke="rgb(148 163 184 / 0.12)" strokeWidth="6" fill="none">
          <path d="M0 60 H400 M0 150 H400 M0 210 H400" />
          <path d="M70 0 V240 M190 0 V240 M310 0 V240" />
          <path d="M0 230 L400 20" strokeWidth="9" />
        </g>
        {/* trajeto percorrido */}
        <path
          d="M40 210 C 90 200, 110 150, 160 140 S 230 90, 250 70"
          stroke="rgb(56 189 248)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* rota restante */}
        <path
          d="M250 70 C 280 55, 320 50, 360 40"
          stroke="rgb(148 163 184 / 0.6)"
          strokeWidth="3"
          strokeDasharray="6 7"
          fill="none"
        />
        <circle cx="40" cy="210" r="6" fill="rgb(52 211 153)" />
        <circle cx="360" cy="40" r="6" fill="rgb(244 114 182)" />
      </svg>
      {/* posição atual */}
      <span className="absolute left-[62.5%] top-[29%] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-sky-500" />
      </span>
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Ao vivo · atualizado há 12 s
      </div>
      {!compacto && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-slate-900/90 px-3 py-2 text-xs backdrop-blur">
          <span className="text-slate-300">V-0142 · Vitória → Guarapari</span>
          <span className="text-slate-400">ABC-1D23 · Carlos</span>
        </div>
      )}
    </div>
  );
}

const ALERTAS = [
  {
    icon: CalendarClock,
    texto: "CNH de João Silva vence em 5 dias",
    tom: "bg-amber-500/15 text-amber-300",
  },
  {
    icon: AlertTriangle,
    texto: "CRLV do veículo QRT-4E12 vencido",
    tom: "bg-red-500/15 text-red-300",
  },
  {
    icon: Wrench,
    texto: "Troca de óleo da van RFE-2B90: faltam 600 km",
    tom: "bg-sky-500/15 text-sky-300",
  },
];

export function ListaAlertas() {
  return (
    <div className="space-y-2.5 p-4">
      {ALERTAS.map(a => (
        <div
          key={a.texto}
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
        >
          <span className={`rounded-lg p-1.5 ${a.tom}`}>
            <a.icon className="h-4 w-4" />
          </span>
          <span className="text-sm text-slate-200">{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

const MESES = [
  { m: "Jun", r: 55, d: 30 },
  { m: "Jul", r: 62, d: 34 },
  { m: "Ago", r: 58, d: 31 },
  { m: "Set", r: 70, d: 36 },
  { m: "Out", r: 76, d: 38 },
  { m: "Nov", r: 84, d: 40 },
];

export function Financeiro() {
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Recebido", "R$ 38.400", "text-emerald-300"],
          ["A receber", "R$ 9.150", "text-sky-300"],
          ["Despesas", "R$ 17.900", "text-rose-300"],
          ["Lucro", "R$ 20.500", "text-white"],
        ].map(([rotulo, valor, cor]) => (
          <div key={rotulo} className="rounded-xl bg-white/[0.04] p-2.5">
            <p className="text-[10px] text-slate-500">{rotulo}</p>
            <p className={`text-sm font-bold ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-28 items-end gap-3">
        {MESES.map(x => (
          <div key={x.m} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end gap-0.5">
              <div
                className="w-1/2 rounded-t bg-emerald-400/70"
                style={{ height: `${x.r}%` }}
              />
              <div
                className="w-1/2 rounded-t bg-rose-400/60"
                style={{ height: `${x.d}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{x.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CelularMotorista() {
  return (
    <div className="mx-auto w-56 rounded-[2rem] border-4 border-slate-700 bg-slate-950 p-3 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-700" />
      <p className="text-xs text-slate-400">Olá, Carlos</p>
      <p className="mb-3 text-sm font-semibold text-white">Suas viagens hoje</p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">V-0142</span>
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-300">
            Planejada
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-300">Vitória → Guarapari</p>
        <p className="text-[11px] text-slate-500">
          Saída 07:30 · 18 passageiros
        </p>
        <button
          type="button"
          tabIndex={-1}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-white"
        >
          <Play className="h-3.5 w-3.5" /> Iniciar viagem
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs text-slate-200"
        >
          <Navigation className="h-3.5 w-3.5" /> Abrir no Waze
        </button>
      </div>
    </div>
  );
}

export function ConversaIA() {
  return (
    <div className="space-y-3 p-4">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white">
        Quais CNHs vencem este mês?
      </div>
      <div className="flex max-w-[90%] gap-2">
        <span className="h-fit rounded-lg bg-purple-500/20 p-1.5 text-purple-300">
          <Bot className="h-4 w-4" />
        </span>
        <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-3.5 py-2 text-sm text-slate-200">
          Duas CNHs vencem em dezembro: <b>João Silva</b> (dia 12) e{" "}
          <b>Carla Souza</b> (dia 28). Os dois continuam disponíveis até lá.
        </div>
      </div>
    </div>
  );
}

const TITULO_JANELA: Record<Destaque["id"], string> = {
  mapa: "Viagens · Rastreamento",
  alertas: "Notificações",
  financeiro: "Financeiro · Novembro",
  motorista: "",
  ia: "Assistente de IA",
};

// Ilustração de cada destaque (id vem de conteudo.ts).
export function IlustracaoDestaque({ id }: { id: Destaque["id"] }) {
  if (id === "motorista") return <CelularMotorista />;
  return (
    <Janela titulo={TITULO_JANELA[id]}>
      {id === "mapa" && <MapaAoVivo />}
      {id === "alertas" && <ListaAlertas />}
      {id === "financeiro" && <Financeiro />}
      {id === "ia" && <ConversaIA />}
    </Janela>
  );
}
