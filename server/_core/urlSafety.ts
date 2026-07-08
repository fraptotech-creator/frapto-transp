import { lookup } from "dns/promises";
import net from "net";

// Bloqueia IPs internos (loopback, privados, link-local, metadata de cloud, CGNAT).
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata 169.254.169.254
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (rede interna de PaaS)
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (
    lower.startsWith("fe80") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd")
  )
    return true;
  if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
  return false;
}

/**
 * Valida uma URL fornecida por usuário (ex.: baseUrl do provedor de IA) contra
 * SSRF: exige https, bloqueia localhost e resolve o host — se cair em IP
 * interno, nega. Lança Error com mensagem amigável.
 */
export async function assertSafeBaseUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL inválida.");
  }
  if (url.protocol !== "https:") {
    throw new Error("A Base URL precisa usar https.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Host não permitido.");
  }
  // Se já é um IP literal, checa direto; senão resolve via DNS.
  if (net.isIP(host)) {
    if (isPrivateIp(host))
      throw new Error("Base URL aponta para endereço interno.");
    return;
  }
  const { address } = await lookup(host);
  if (isPrivateIp(address)) {
    throw new Error("Base URL aponta para endereço interno (bloqueado).");
  }
}
