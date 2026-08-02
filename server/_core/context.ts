import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getGateUser } from "./uploadCapability";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // No path de upload, a barreira (uploadGate) já validou a sessão ATIVA
  // (usuário existe + sver bate) e deixou o usuário em res.locals. Reusa aqui
  // para NÃO repetir a consulta ao banco nem manter duas implementações de
  // autenticação divergentes. A marca é interna (símbolo em res.locals), nunca
  // vinda de header do cliente.
  const gateUser = getGateUser(opts.res);
  if (gateUser) {
    user = gateUser;
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
