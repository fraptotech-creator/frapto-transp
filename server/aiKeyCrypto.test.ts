import { describe, it, expect } from "vitest";
import { encryptWithKey, decryptWithKey, ehCifrado } from "./_core/aiKeyCrypto";

const KEY = Buffer.alloc(32, 7); // chave fixa de teste (32 bytes)
const KEY2 = Buffer.alloc(32, 9);
const PLAIN = "sk_live_superSecretaDoTenant_12345";

describe("aiKeyCrypto (AES-256-GCM)", () => {
  it("round-trip: decrypt(encrypt(x)) === x", () => {
    const enc = encryptWithKey(PLAIN, KEY);
    expect(ehCifrado(enc)).toBe(true);
    expect(decryptWithKey(enc, KEY)).toBe(PLAIN);
  });

  it("o ciphertext NÃO contém o texto puro", () => {
    const enc = encryptWithKey(PLAIN, KEY);
    expect(enc.includes(PLAIN)).toBe(false);
    expect(enc.includes("superSecreta")).toBe(false);
  });

  it("IV aleatório: duas cifragens do mesmo texto diferem", () => {
    expect(encryptWithKey(PLAIN, KEY)).not.toBe(encryptWithKey(PLAIN, KEY));
  });

  it("chave errada FALHA (autenticação GCM) — não devolve lixo", () => {
    const enc = encryptWithKey(PLAIN, KEY);
    expect(() => decryptWithKey(enc, KEY2)).toThrow();
  });

  it("ciphertext adulterado (tag/ct) FALHA", () => {
    const enc = encryptWithKey(PLAIN, KEY);
    const parts = enc.split(":");
    parts[4] = Buffer.from("outra coisa").toString("base64"); // troca o ct
    expect(() => decryptWithKey(parts.join(":"), KEY)).toThrow();
  });

  it("legado em CLARO (sem prefixo v1:) passa direto", () => {
    expect(ehCifrado("sk_plaintext")).toBe(false);
    expect(decryptWithKey("sk_plaintext", KEY)).toBe("sk_plaintext");
  });
});
