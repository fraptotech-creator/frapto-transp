// Detecção de tipo por ASSINATURA (magic bytes) — NUNCA confie no contentType
// que o cliente declara. Sem isto, dá para subir HTML/SVG/JS rotulado como
// "image/png": passa no allowlist declarado, é gravado e servido inline pelo
// CDN → XSS. Aqui o tipo REAL sai dos bytes; o router grava com ele.

export type DocMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

// Retorna o MIME real do conteúdo, ou null se não for um dos tipos aceitos.
// Fail-closed: qualquer coisa que não bata uma assinatura conhecida é negada.
export function detectDocMime(buf: Buffer): DocMime | null {
  if (buf.length < 12) return null;
  // PDF: "%PDF-"
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return "application/pdf";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
