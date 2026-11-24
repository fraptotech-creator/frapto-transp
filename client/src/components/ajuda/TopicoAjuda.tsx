import { Lightbulb } from "lucide-react";
import {
  ancoraTopico,
  caminhoCapa,
  caminhoVideo,
  type Topico,
} from "./conteudo";

// Uma função do sistema: vídeo curto (gravado no app, sem som, com legenda na
// tela) + o mesmo passo a passo em texto, para quem prefere ler.
export function TopicoAjuda({ topico }: { topico: Topico }) {
  const vertical = topico.video?.vertical ?? false;
  return (
    <article
      id={ancoraTopico(topico.id)}
      className="scroll-mt-40 rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6 lg:scroll-mt-24"
    >
      <h3 className="text-xl font-bold text-white">{topico.titulo}</h3>
      <p className="mt-1 text-slate-400">{topico.resumo}</p>
      <div
        className={
          vertical
            ? "mt-5 grid gap-6 md:grid-cols-[280px_1fr]"
            : "mt-5 grid gap-6 xl:grid-cols-[1.5fr_1fr]"
        }
      >
        {topico.video && (
          <video
            controls
            playsInline
            preload="none"
            poster={caminhoCapa(topico.id)}
            aria-label={`Vídeo: ${topico.titulo}`}
            className={
              vertical
                ? "mx-auto w-full max-w-[280px] rounded-2xl border border-white/10 bg-black"
                : "w-full rounded-xl border border-white/10 bg-black"
            }
          >
            <source src={caminhoVideo(topico.id)} type="video/mp4" />
          </video>
        )}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Passo a passo
          </p>
          <ol className="mt-3 space-y-3">
            {topico.passos.map((passo, i) => (
              <li key={passo} className="flex gap-3 text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
          {topico.dica && (
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100/90">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>{topico.dica}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
