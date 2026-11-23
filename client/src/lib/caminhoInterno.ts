// Só deixa passar caminho INTERNO do próprio app. "//host" e "/\host"
// começam com "/" mas o navegador trata como OUTRO site (protocol-relative):
// ?next=//site-falso.com levaria quem acabou de redefinir a senha para uma
// página de phishing. Mesma regra do sanitizeReturnPath do login Google.
export function caminhoInterno(raw: string | null | undefined, padrao = "/") {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\")
  ) {
    return padrao;
  }
  return raw;
}
