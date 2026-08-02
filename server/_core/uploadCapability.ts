import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { User } from "../../drizzle/schema";

// Path canônico (relativo ao mount /api/trpc) da única procedure que precisa do
// parser grande. Sem batching, um POST carrega exatamente uma procedure.
export const UPLOAD_PROC = "documents.upload";

// Marca INTERNA de que a barreira de upload aprovou ESTA request. Fica em
// res.locals sob um SÍMBOLO privado — controlado só pelo servidor; um header ou
// campo forjado pelo cliente jamais alcança isto. O parser de 15 MB só é
// escolhido quando a marca existe (ver makeTrpcParserSelector). O usuário já
// validado (sessão ATIVA) viaja junto para o contexto tRPC reusar, sem repetir
// a consulta ao banco.
const UPLOAD_OK = Symbol("uploadGateOk");
const GATE_USER = Symbol("uploadGateUser");
const TRPC_PROC = Symbol("trpcProc");

type GateLocals = {
  [UPLOAD_OK]?: true;
  [GATE_USER]?: User;
  [TRPC_PROC]?: string;
};

// res.locals é um saco não-tipado (Record<string, any>); esta é a VISÃO tipada
// das nossas chaves-símbolo. Não esconde type mismatch — só nomeia o que
// gravamos ali. Nada externo escreve estas chaves (são símbolos privados).
function bag(res: Response): GateLocals {
  return res.locals as GateLocals;
}

// Procedure canônica desta request (definida pela canonicalização). undefined
// antes de a canonicalização rodar.
export function setTrpcProc(res: Response, proc: string): void {
  bag(res)[TRPC_PROC] = proc;
}
export function getTrpcProc(res: Response): string | undefined {
  return bag(res)[TRPC_PROC];
}

// Concede a capacidade de usar o parser grande a ESTA request e guarda o
// usuário já validado (sessão ativa) para o contexto tRPC reusar.
export function grantUploadCapability(res: Response, user: User): void {
  const b = bag(res);
  b[UPLOAD_OK] = true;
  b[GATE_USER] = user;
}
export function hasUploadCapability(res: Response): boolean {
  return bag(res)[UPLOAD_OK] === true;
}
export function getGateUser(res: Response): User | undefined {
  return bag(res)[GATE_USER];
}

// Seletor do parser do /api/trpc. O parser GRANDE (15 MB) exige, ao MESMO
// tempo: método POST, path canônico do upload E a marca interna de que a
// barreira aprovou. Falta qualquer uma → parser PEQUENO (128 KB). Assim o
// tamanho grande NUNCA é escolhido por path sozinho (nem por método, nem por
// alias): é uma capacidade que só a barreira concede.
export function makeTrpcParserSelector(
  smallParser: RequestHandler,
  uploadParser: RequestHandler
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const isUpload =
      req.method === "POST" &&
      getTrpcProc(res) === UPLOAD_PROC &&
      hasUploadCapability(res);
    (isUpload ? uploadParser : smallParser)(req, res, next);
  };
}
