// Regras PURAS do app do motorista (sem DOM, sem plugin) — testadas em
// server/appMotoristaLogica.test.ts. O main.js só liga isto à tela e ao GPS.

export const BASE = "https://www.fraptotransp.com.br";

// Mesmo deep link do site (client/src/lib/nav.ts): abre o Waze já navegando.
export function wazeUrl(endereco) {
  return `https://waze.com/ul?q=${encodeURIComponent(
    String(endereco ?? "").trim()
  )}&navigate=yes`;
}

// O GPS em segundo plano só precisa ficar LIGADO enquanto houver viagem em
// andamento (o servidor, de todo jeito, só grava posição nesse estado). Assim
// não gasta bateria nem mostra a notificação fora de viagem.
export function rastreioDeveEstarAtivo(viagens) {
  return (viagens ?? []).some(v => v && v.status === "em_andamento");
}

// Opções do plugin @capgo/background-geolocation: ele mesmo POSTa a posição no
// /api/track (HTTP nativo, continua com o app fechado), com o token no
// cabeçalho. O corpo vai com source:"native" e o servidor converte m/s→km/h.
export function configRastreio(token) {
  return {
    backgroundTitle: "Frapto Motorista",
    backgroundMessage: "Viagem em andamento — compartilhando sua localização.",
    requestPermissions: true,
    stale: false,
    distanceFilter: 30,
    minIntervalMs: 15000,
    // GPS mudo por 20+ s (túnel, cidade densa, tela apagada): usa a posição da
    // rede do celular, mais grosseira, em vez de deixar buraco no trajeto.
    networkFallback: true,
    url: `${BASE}/api/track`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

// "2026-11-24T15:30" (input datetime-local, hora LOCAL do celular) → ISO.
export function chegadaParaIso(valorInput) {
  const d = new Date(valorInput);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Valor inicial do campo de chegada: agora, na hora local.
export function agoraParaInput(agora = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(
    agora.getDate()
  )}T${p(agora.getHours())}:${p(agora.getMinutes())}`;
}

export function formatarDataHora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Mensagem que o servidor manda quando a assinatura da empresa venceu (sentinela
// do tRPC) vira texto para o motorista.
export function mensagemDeErro(status, texto) {
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (status === 402 || /SUBSCRIPTION_REQUIRED/.test(texto ?? "")) {
    return "A assinatura da empresa está inativa. Fale com o seu gestor.";
  }
  if (/PASSWORD_CHANGE_REQUIRED/.test(texto ?? "")) {
    return "Defina a sua senha pelo link que o gestor enviou e entre de novo.";
  }
  return texto || `Não foi possível concluir (erro ${status}).`;
}
