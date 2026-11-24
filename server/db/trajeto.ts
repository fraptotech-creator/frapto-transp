import { and, asc, eq, lt, lte } from "drizzle-orm";
import { tripPositions, tripTrajetoResumos } from "../../drizzle/schema";
import { getDb } from "./client";
import {
  montarResumo,
  type PontoResumo,
  type PontoTrajeto,
} from "../_core/trajeto";
import { linhasAfetadas } from "../_core/exclusao";

// Resumo do trajeto de uma viagem (null = nunca resumida).
export async function getTrajetoResumo(
  orgId: number,
  tripId: number
): Promise<PontoResumo[] | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .select({ pontos: tripTrajetoResumos.pontos })
    .from(tripTrajetoResumos)
    .where(
      and(
        eq(tripTrajetoResumos.orgId, orgId),
        eq(tripTrajetoResumos.tripId, tripId)
      )
    )
    .limit(1);
  return r[0]?.pontos ?? null;
}

// Viagens que têm posições mais antigas que o corte (usa o índice por data).
export async function viagensComPosicoesAntigas(
  corte: Date,
  limite: number
): Promise<{ orgId: number; tripId: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .selectDistinct({
      orgId: tripPositions.orgId,
      tripId: tripPositions.tripId,
    })
    .from(tripPositions)
    .where(lt(tripPositions.capturedAt, corte))
    .limit(limite);
}

// Teto de posições resumidas/apagadas por viagem numa passada. Uma viagem com
// mais que isso termina na próxima execução (nada se perde: só é apagado o que
// entrou no resumo).
const MAX_POR_VIAGEM = 50000;

// Numa TRANSAÇÃO: lê o resumo atual e as posições antigas da viagem, grava o
// resumo novo (antigo + estas, simplificado junto) e SÓ ENTÃO apaga exatamente
// as posições lidas (id <= o último lido). Falhou no meio → rollback, nada
// apagado. Executar de novo é seguro (idempotente).
export async function resumirEApagarPosicoesAntigas(
  orgId: number,
  tripId: number,
  corte: Date
): Promise<{ apagadas: number; pontosResumo: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const doViagem = and(
      eq(tripPositions.orgId, orgId),
      eq(tripPositions.tripId, tripId),
      lt(tripPositions.capturedAt, corte)
    );
    const posicoes = await tx
      .select({
        id: tripPositions.id,
        lat: tripPositions.lat,
        lng: tripPositions.lng,
        capturedAt: tripPositions.capturedAt,
      })
      .from(tripPositions)
      .where(doViagem)
      .orderBy(asc(tripPositions.id))
      .limit(MAX_POR_VIAGEM);
    if (posicoes.length === 0) return { apagadas: 0, pontosResumo: 0 };

    const atual = await tx
      .select({ pontos: tripTrajetoResumos.pontos })
      .from(tripTrajetoResumos)
      .where(
        and(
          eq(tripTrajetoResumos.orgId, orgId),
          eq(tripTrajetoResumos.tripId, tripId)
        )
      )
      .limit(1);

    const apagar: PontoTrajeto[] = posicoes.map(p => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      t: p.capturedAt.getTime(),
    }));
    const pontos = montarResumo(atual[0]?.pontos ?? null, apagar);

    await tx
      .insert(tripTrajetoResumos)
      .values({ orgId, tripId, pontos })
      .onDuplicateKeyUpdate({ set: { pontos } });

    const ultimoId = posicoes[posicoes.length - 1].id;
    const res = await tx
      .delete(tripPositions)
      .where(and(doViagem, lte(tripPositions.id, ultimoId)));
    return { apagadas: linhasAfetadas(res), pontosResumo: pontos.length };
  });
}
