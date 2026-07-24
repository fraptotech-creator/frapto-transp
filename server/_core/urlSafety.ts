import { lookup } from "dns/promises";
import net from "net";

// Bloqueia IPs internos (loopback, privados, link-local, metadata de cloud,
// CGNAT, broadcast, multicast e reservados). Fail-closed: IP não reconhecível
// como público é tratado como não-permitido pelo chamador.
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata 169.254.169.254
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (rede interna de PaaS)
    if (a === 255) return true; // broadcast (255.255.255.255)
    if (a >= 224) return true; // multicast (224-239) + reservado (240-255)
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // fc00::/7 (unique-local) e fe80::/10 (link-local). fe80::/10 = fe80..febf,
  // ou seja, prefixo fe8/fe9/fea/feb.
  if (/^f[cd]/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  // IPv4 embutido: ::ffff:1.2.3.4 (mapped) e ::x.x.x.x (compat).
  if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
  const embutido = lower.match(/^::((\d{1,3}\.){3}\d{1,3})$/);
  if (embutido) return isPrivateIp(embutido[1]);
  return false;
}

// Classificação PURA da URL (sem DNS): protocolo, host proibido e IP literal.
// Testável sem rede. Retorna null se ok até aqui, ou a mensagem de bloqueio.
// A resolução DNS (para hostnames) fica em assertSafeBaseUrl.
export function classifyBaseUrl(
  raw: string
): { bloqueado: true; motivo: string } | { bloqueado: false; host: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { bloqueado: true, motivo: "Base URL inválida." };
  }
  if (url.protocol !== "https:") {
    return { bloqueado: true, motivo: "A Base URL precisa usar https." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // tira [] de IPv6
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { bloqueado: true, motivo: "Host não permitido." };
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    return {
      bloqueado: true,
      motivo: "Base URL aponta para endereço interno.",
    };
  }
  return { bloqueado: false, host };
}

/**
 * Valida uma URL fornecida por usuário (ex.: baseUrl do provedor de IA) contra
 * SSRF: exige https, bloqueia localhost e resolve o host — se cair em IP
 * interno, nega. Lança Error com mensagem amigável.
 */
export async function assertSafeBaseUrl(raw: string): Promise<void> {
  const c = classifyBaseUrl(raw);
  if (c.bloqueado) throw new Error(c.motivo);
  // Já é IP literal público → classifyBaseUrl já aprovou.
  if (net.isIP(c.host)) return;
  // Hostname: resolve TODOS os IPs (all:true) e nega se QUALQUER um for interno
  // — um host malicioso pode devolver vários registros (um público + um interno).
  const enderecos = await lookup(c.host, { all: true });
  if (enderecos.length === 0) {
    throw new Error("Base URL não resolve para nenhum endereço.");
  }
  for (const { address } of enderecos) {
    if (isPrivateIp(address)) {
      throw new Error("Base URL aponta para endereço interno (bloqueado).");
    }
  }
}
