import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { appRouter } from "../routers";
import { tokenDaRequisicao } from "../_core/trackIngest";
import { trackingTokenBloqueado } from "../_core/tracking";
import { toSafeLogError } from "../_core/safeLog";
import { getDriverByTrackingToken, getDriverUser } from "../db";

// API REST do APP NATIVO do motorista (APK). O app tem telas próprias (não abre
// o site dentro dele) e se autentica pelo TOKEN DE RASTREIO no cabeçalho
// "Authorization: Bearer <token>". Para não duplicar regra de negócio, cada
// rota resolve o motorista pelo token e chama o MESMO procedimento tRPC do app
// web (driverApp.*): só as viagens dele, sem valores, máquina de estados,
// motorista inativo e assinatura — tudo validado lá (driverProcedure).

type Caller = ReturnType<typeof appRouter.createCaller>;

// Resolve o motorista do token e monta o caller tRPC com o usuário DELE.
// Responde 401 e devolve null quando o token não serve (fail-closed).
async function callerDoToken(
  req: Request,
  res: Response
): Promise<Caller | null> {
  const token = tokenDaRequisicao(undefined, req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Faça login novamente." });
    return null;
  }
  const driver = await getDriverByTrackingToken(token);
  if (!driver || trackingTokenBloqueado(driver, new Date())) {
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    return null;
  }
  const user = await getDriverUser(driver.orgId, driver.id);
  if (!user) {
    res.status(401).json({ error: "Faça login novamente." });
    return null;
  }
  return appRouter.createCaller({ req, res, user });
}

// Erro do tRPC vira o MESMO status HTTP e a mensagem legível; o resto é 500
// genérico (sem vazar detalhe interno), com log sem PII.
function responderErro(res: Response, rota: string, err: unknown) {
  if (err instanceof TRPCError) {
    res.status(getHTTPStatusCodeFromError(err)).json({ error: err.message });
    return;
  }
  console.error(`[app-motorista] ${rota}`, toSafeLogError(err));
  res.status(500).json({ error: "Erro interno. Tente de novo." });
}

function idDaRota(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function handleListarViagens(req: Request, res: Response) {
  try {
    const caller = await callerDoToken(req, res);
    if (!caller) return;
    const viagens = await caller.driverApp.myTrips();
    res.status(200).json({ viagens });
  } catch (err) {
    responderErro(res, "viagens", err);
  }
}

export async function handleIniciarViagem(req: Request, res: Response) {
  try {
    const id = idDaRota(req);
    if (id == null) {
      res.status(400).json({ error: "Viagem inválida." });
      return;
    }
    const caller = await callerDoToken(req, res);
    if (!caller) return;
    res.status(200).json(await caller.driverApp.startTrip({ id }));
  } catch (err) {
    responderErro(res, "iniciar", err);
  }
}

export async function handleConcluirViagem(req: Request, res: Response) {
  try {
    const id = idDaRota(req);
    const bruto = (req.body as Record<string, unknown> | undefined)
      ?.dataChegada;
    const dataChegada =
      typeof bruto === "string" ? new Date(bruto) : new Date(Number.NaN);
    if (id == null || Number.isNaN(dataChegada.getTime())) {
      res.status(400).json({ error: "Informe a viagem e a hora de chegada." });
      return;
    }
    const caller = await callerDoToken(req, res);
    if (!caller) return;
    res
      .status(200)
      .json(await caller.driverApp.completeTrip({ id, dataChegada }));
  } catch (err) {
    responderErro(res, "concluir", err);
  }
}
