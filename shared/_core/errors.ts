/**
 * Erro HTTP com status. Base do ForbiddenError usado pelo sdk.
 */
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const ForbiddenError = (msg: string) => new HttpError(403, msg);
