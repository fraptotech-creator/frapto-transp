import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { normalizeTrackPayload } from "../_core/trackIngest";
import {
  planTrackInserts,
  distinctTripIds,
  trackingTokenBloqueado,
  type TripRef,
} from "../_core/tracking";
import { assinaturaAtiva } from "../_core/subscription";
import { toSafeLogError } from "../_core/safeLog";
import {
  getDriverByTrackingToken,
  getUserByUsername,
  getDriverById,
  issueTrackingToken,
  migrateTrackingTokenToHash,
  revokeTrackingToken,
  getTripById,
  getTrips,
  addTripPositions,
  getOrganization,
} from "../db";

// Login REST do app NATIVO de rastreio (sem tRPC/superjson). Valida
// usuário+senha do motorista e devolve o token de rastreio. Fail-closed;
// protegido por rate-limit estrito na borda (authLimiter).
export async function handleTrackLogin(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username =
      typeof body.username === "string"
        ? body.username.toLowerCase().trim()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      res.status(400).json({ error: "informe usuário e senha" });
      return;
    }
    const user = await getUserByUsername(username);
    if (
      !user ||
      !user.passwordHash ||
      user.orgRole !== "driver" ||
      !user.orgId ||
      !user.driverId
    ) {
      res.status(401).json({ error: "usuário ou senha inválidos" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "usuário ou senha inválidos" });
      return;
    }
    const driver = await getDriverById(user.orgId, user.driverId);
    if (!driver) {
      res.status(401).json({ error: "motorista não encontrado" });
      return;
    }
    // Gate de assinatura: sem pagamento em dia, nem emite token de rastreio.
    // Sem isto o app nativo era um bypass do paywall (grava GPS de graça).
    const org = await getOrganization(user.orgId);
    if (!assinaturaAtiva(org?.subscriptionStatus)) {
      res.status(402).json({ error: "assinatura inativa" });
      return;
    }
    // SEMPRE emite um token NOVO no login (rotação). Só o hash é guardado; o
    // valor em claro vai para o aparelho. "Um aparelho por vez": o hash anterior
    // é sobrescrito, invalidando o aparelho antigo (decisão do produto).
    const token = await issueTrackingToken(user.orgId, user.driverId);
    res.status(200).json({ token, nome: driver.nome });
  } catch (err) {
    console.error("[track] login error", toSafeLogError(err));
    res.status(500).json({ error: "erro interno" });
  }
}

// Ingestão de posição do app NATIVO (GPS em segundo plano). Autenticado por
// token de motorista — org/driverId saem do registro do token, nunca do
// cliente. Só grava se a viagem for do motorista E estiver em andamento
// (canRecordPosition), igual ao caminho do tRPC. Fail-closed em tudo.
export async function handleTrackIngest(req: Request, res: Response) {
  try {
    const { token, points } = normalizeTrackPayload(req.body);
    if (!token || points.length === 0) {
      res.status(400).json({ error: "payload inválido" });
      return;
    }
    const driver = await getDriverByTrackingToken(token);
    if (!driver) {
      res.status(401).json({ error: "token inválido" });
      return;
    }
    // Token expirado (1 ano) ou revogado (logout/reset) → nega.
    if (trackingTokenBloqueado(driver, new Date())) {
      res.status(401).json({ error: "token expirado ou revogado" });
      return;
    }
    // Migração LAZY: aparelho legado (achado pelo valor em claro, sem hash)
    // passa a hash no primeiro ping — o token-em-claro some do banco sozinho.
    if (!driver.trackingTokenHash) {
      await migrateTrackingTokenToHash(driver.orgId, driver.id, token);
    }
    // Mesmo com token válido, uma frota inadimplente não grava GPS: o gate de
    // assinatura vale para TODA borda, não só o tRPC. A org sai do registro do
    // token (fail-closed), nunca do cliente.
    const org = await getOrganization(driver.orgId);
    if (!assinaturaAtiva(org?.subscriptionStatus)) {
      res.status(402).json({ error: "assinatura inativa" });
      return;
    }

    // Viagem ativa do motorista (fallback quando o ponto não traz tripId).
    // Só busca se ALGUM ponto depender do fallback.
    const precisaAtiva = points.some(p => p.tripId == null);
    let activeTripId = -1;
    if (precisaAtiva) {
      const trips = await getTrips(driver.orgId);
      const active = trips.find(
        t => t.motoristaId === driver.id && t.status === "em_andamento"
      );
      activeTripId = active ? active.id : -1;
    }

    // Carrega cada viagem DISTINTA uma única vez (antes: um getTripById por
    // ponto). O planejamento (dono + em_andamento + clamp de velocidade) é
    // puro; aqui só resolvemos I/O e inserimos em lote.
    const tripsById = new Map<number, TripRef | null | undefined>();
    for (const id of distinctTripIds(points, activeTripId)) {
      tripsById.set(id, await getTripById(driver.orgId, id));
    }

    const rows = planTrackInserts({
      points,
      activeTripId,
      tripsById,
      driverId: driver.id,
    });
    await addTripPositions(driver.orgId, rows);
    res.status(200).json({ recorded: rows.length });
  } catch (err) {
    console.error("[track] ingest error", toSafeLogError(err));
    res.status(500).json({ error: "erro interno" });
  }
}

// Logout do app NATIVO: revoga o token no SERVIDOR (mata a credencial mesmo se
// o aparelho for perdido). Autenticado pelo próprio token. Idempotente: token
// desconhecido também responde 200 (não vira oráculo de tokens válidos).
export async function handleTrackRevoke(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    if (token) {
      const driver = await getDriverByTrackingToken(token);
      if (driver) await revokeTrackingToken(driver.orgId, driver.id);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[track] revoke error", toSafeLogError(err));
    res.status(500).json({ error: "erro interno" });
  }
}
