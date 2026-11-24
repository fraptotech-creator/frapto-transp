import {
  BarChart3,
  Bell,
  DollarSign,
  FileText,
  MapPin,
  Rocket,
  Settings,
  Smartphone,
  Sparkles,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { ancoraTopico, type Modulo, type ModuloId } from "./conteudo";

export const ICONE_MODULO: Record<ModuloId, LucideIcon> = {
  "primeiros-passos": Rocket,
  veiculos: Truck,
  motoristas: Users,
  viagens: MapPin,
  "app-motorista": Smartphone,
  manutencao: Wrench,
  financeiro: DollarSign,
  relatorios: BarChart3,
  documentos: FileText,
  alertas: Bell,
  assistente: Sparkles,
  configuracoes: Settings,
};

type Props = { modulos: Modulo[]; ativo: ModuloId | null };

// Menu lateral (computador): módulos e, dentro, as funções. Leva direto à
// função clicada.
export function MenuLateral({ modulos, ativo }: Props) {
  return (
    <nav aria-label="Módulos da ajuda" className="space-y-1">
      {modulos.map(m => {
        const Icone = ICONE_MODULO[m.id];
        const aberto = ativo === m.id;
        return (
          <div key={m.id}>
            <a
              href={`#${m.id}`}
              aria-current={aberto ? "true" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                aberto
                  ? "bg-primary/15 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icone
                className={`h-4 w-4 ${aberto ? "text-primary" : "text-slate-500"}`}
              />
              {m.titulo}
            </a>
            {aberto && (
              <ul className="mb-2 ml-9 mt-1 space-y-1 border-l border-white/10 pl-3">
                {m.topicos.map(t => (
                  <li key={t.id}>
                    <a
                      href={`#${ancoraTopico(t.id)}`}
                      className="block py-0.5 text-sm text-slate-400 hover:text-white"
                    >
                      {t.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Celular/tablet: os módulos viram uma faixa de botões que rola para o lado.
// O botão do módulo que está na tela desliza para a vista sozinho.
export function MenuFaixa({ modulos, ativo }: Props) {
  const faixa = useRef<HTMLElement>(null);
  useEffect(() => {
    const botao = faixa.current?.querySelector<HTMLElement>(
      `[data-modulo-id="${ativo}"]`
    );
    if (!botao || !faixa.current) return;
    faixa.current.scrollTo({
      left:
        botao.offsetLeft -
        faixa.current.clientWidth / 2 +
        botao.clientWidth / 2,
      behavior: "smooth",
    });
  }, [ativo]);
  return (
    <nav
      ref={faixa}
      aria-label="Módulos da ajuda"
      className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      {modulos.map(m => {
        const Icone = ICONE_MODULO[m.id];
        return (
          <a
            key={m.id}
            href={`#${m.id}`}
            data-modulo-id={m.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
              ativo === m.id
                ? "border-primary/50 bg-primary/15 text-white"
                : "border-white/10 text-slate-400"
            }`}
          >
            <Icone className="h-3.5 w-3.5" />
            {m.titulo}
          </a>
        );
      })}
    </nav>
  );
}
