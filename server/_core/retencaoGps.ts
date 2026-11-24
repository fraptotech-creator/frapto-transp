import { corteRetencao } from "./trajeto";
import { toSafeLogError } from "./safeLog";
import {
  resumirEApagarPosicoesAntigas,
  viagensComPosicoesAntigas,
} from "../db";

// Retenção de GPS (decisão do dono, 24/11/2026): uma vez por dia, cada viagem
// com posições de mais de 90 dias tem o trajeto RESUMIDO (até ~100 pontos,
// guardado para sempre) e as posições detalhadas antigas APAGADAS — numa
// transação por viagem (db/trajeto.ts). Uma viagem que falha não trava as
// outras e é refeita no dia seguinte.

const LOTE = 200; // viagens por consulta
const MAX_LOTES = 25; // teto por execução (5.000 viagens); o resto fica p/ amanhã

export type DepsRetencao = {
  viagensComPosicoesAntigas: typeof viagensComPosicoesAntigas;
  resumirEApagarPosicoesAntigas: typeof resumirEApagarPosicoesAntigas;
};

const depsPadrao: DepsRetencao = {
  viagensComPosicoesAntigas,
  resumirEApagarPosicoesAntigas,
};

export type ResultadoRetencao = {
  viagens: number;
  ok: number;
  falhas: number;
  apagadas: number;
};

export async function executarRetencaoGps(
  agora: Date = new Date(),
  deps: DepsRetencao = depsPadrao
): Promise<ResultadoRetencao> {
  const corte = corteRetencao(agora);
  const r: ResultadoRetencao = { viagens: 0, ok: 0, falhas: 0, apagadas: 0 };
  const falharam = new Set<string>();
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const viagens = (await deps.viagensComPosicoesAntigas(corte, LOTE)).filter(
      v => !falharam.has(`${v.orgId}:${v.tripId}`)
    );
    if (viagens.length === 0) break;
    for (const v of viagens) {
      r.viagens++;
      try {
        const res = await deps.resumirEApagarPosicoesAntigas(
          v.orgId,
          v.tripId,
          corte
        );
        r.ok++;
        r.apagadas += res.apagadas;
      } catch (err) {
        // Não para a limpeza das outras; esta tenta de novo amanhã.
        r.falhas++;
        falharam.add(`${v.orgId}:${v.tripId}`);
        console.error(
          `[retencao-gps] viagem ${v.tripId} (org ${v.orgId}) falhou`,
          toSafeLogError(err)
        );
      }
    }
    // Só falhas neste lote → a mesma consulta voltaria igual; encerra.
    if (viagens.every(v => falharam.has(`${v.orgId}:${v.tripId}`))) break;
  }
  if (r.viagens > 0) {
    console.log(
      `[retencao-gps] ${r.ok} viagens resumidas, ${r.apagadas} posições apagadas, ${r.falhas} falhas`
    );
  }
  return r;
}

const PRIMEIRA_EXECUCAO_MS = 10 * 60 * 1000; // 10 min após o boot
const INTERVALO_MS = 24 * 60 * 60 * 1000; // diária

// Agenda a retenção no próprio processo (1 réplica hoje). Nunca roda duas ao
// mesmo tempo; timers com unref() não seguram o desligamento do servidor.
// Devolve a função que cancela o agendamento.
export function agendarRetencaoGps(): () => void {
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await executarRetencaoGps();
    } catch (err) {
      console.error("[retencao-gps] execução falhou", toSafeLogError(err));
    } finally {
      rodando = false;
    }
  };
  const primeira = setTimeout(rodar, PRIMEIRA_EXECUCAO_MS);
  const diaria = setInterval(rodar, INTERVALO_MS);
  primeira.unref();
  diaria.unref();
  return () => {
    clearTimeout(primeira);
    clearInterval(diaria);
  };
}
