// Seleção do parser de corpo do /api/trpc. Só o upload de documento precisa de
// corpo grande (arquivo 10 MB → ~13,3 MB em base64); todas as outras procedures
// mandam JSON pequeno. Dar 15 MB a TODAS deixava qualquer chamada pública
// consumir memória/CPU antes do rate-limit. Decisão PURA (testável); o parser
// roda SEMPRE depois do rate-limit + originCheck.
//
// Dentro do mount app.use("/api/trpc", ...), req.path é RELATIVO ao prefixo,
// então o upload é exatamente "/documents.upload" (batching está desativado, um
// procedure por requisição).
export function isTrpcUploadPath(path: string): boolean {
  return path === "/documents.upload";
}
