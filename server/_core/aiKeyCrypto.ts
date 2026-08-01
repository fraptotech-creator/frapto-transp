import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ENV } from "./env";

// Cifragem AUTENTICADA (AES-256-GCM) da apiKey de IA de cada empresa em repouso.
// Antes a chave do tenant ficava em CLARO no banco: um dump vazava a credencial
// do provedor de IA de cada cliente. Formato versionado com keyId para permitir
// rotação futura sem quebrar o que já está cifrado:
//   v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>
// Leitura aceita também o formato LEGADO (sem prefixo "v1:") = texto puro, para
// migração sem perder chaves; a escrita é sempre cifrada.

const KEY_ID = "k1";

// ── Núcleo PURO (chave explícita) — testável sem env ──
export function encryptWithKey(plain: string, keyBytes: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${KEY_ID}:${iv.toString("base64")}:${tag.toString(
    "base64"
  )}:${ct.toString("base64")}`;
}

export function decryptWithKey(stored: string, keyBytes: Buffer): string {
  // Legado (sem versão) = texto puro; devolve como está (migra na próxima escrita).
  if (!stored.startsWith("v1:")) return stored;
  const parts = stored.split(":");
  if (parts.length !== 5)
    throw new Error("Formato de apiKey cifrada inválido.");
  const [, , ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return out.toString("utf8");
}

export function ehCifrado(stored: string): boolean {
  return stored.startsWith("v1:");
}

// ── Borda (lê a chave do ENV) ──
function keyBytes(): Buffer {
  const raw = ENV.aiConfigEncryptionKey;
  if (!raw) throw new Error("AI_CONFIG_ENCRYPTION_KEY ausente.");
  const b = Buffer.from(raw, "base64");
  if (b.length !== 32) {
    throw new Error("AI_CONFIG_ENCRYPTION_KEY inválida (esperado 32 bytes).");
  }
  return b;
}

export function encryptAiKey(plain: string): string {
  return encryptWithKey(plain, keyBytes());
}

// Decifra para uso interno (chamar o provedor). Legado em claro não precisa da
// chave. Ciphertext exige a chave; falha de autenticação PROPAGA (fail-closed —
// nunca devolve lixo).
export function decryptAiKey(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (!ehCifrado(stored)) return stored;
  return decryptWithKey(stored, keyBytes());
}
