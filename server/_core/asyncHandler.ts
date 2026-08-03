import type { Request, Response, NextFunction, RequestHandler } from "express";

// Adaptador para middleware ASSÍNCRONO no Express 4. O Express 4 NÃO encaminha a
// rejeição de um handler `async` montado direto: uma Promise rejeitada (ex.:
// db.getUserByOpenId lançando dentro de validateActiveSession) vira
// unhandledRejection e pode DERRUBAR o processo. Aqui a rejeição é capturada e
// vira next(error) → cai no handler de erro (resposta 5xx sanitizada), sem
// alcançar o parser nem conceder capability.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
