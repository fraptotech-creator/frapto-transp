import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { FraptoDeviceAdmin } from "frapto-device-admin";
import {
  BASE,
  agoraParaInput,
  chegadaParaIso,
  configRastreio,
  formatarDataHora,
  mensagemDeErro,
  rastreioDeveEstarAtivo,
  wazeUrl,
} from "./logica.js";

// App do MOTORISTA (APK): telas próprias + GPS em segundo plano. Conversa só
// com a API /api/track/* do servidor, autenticado pelo token de rastreio
// (Authorization: Bearer). As regras (só as viagens dele, sem valores,
// estados válidos) são do servidor — aqui é só tela.

const TOKEN_KEY = "frapto_track_token";
const NAME_KEY = "frapto_track_name";
const CONSENT_KEY = "frapto_track_consent";

const $ = id => document.getElementById(id);
// Falha não-fatal (ex.: parar um GPS que já estava parado): registra no log do
// app (Logcat) com contexto, sem derrubar a tela. Nunca engole calado.
const avisar = e => console.warn("[frapto-motorista]", e?.message ?? e);
const isNative = Capacitor.isNativePlatform();

// ─── Telas ────────────────────────────────────────────────────────────────
const VIEWS = ["loginView", "consentView", "homeView"];
function mostrar(view) {
  for (const v of VIEWS) $(v).classList.toggle("hidden", v !== view);
}

// ─── HTTP (nativo, sem CORS) ───────────────────────────────────────────────
async function api(method, path, body) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${BASE}${path}`;
  let status;
  let data;
  if (isNative) {
    const r = await CapacitorHttp.request({ method, url, headers, data: body });
    status = r.status;
    data = r.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = { error: data };
      }
    }
  } else {
    const r = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = r.status;
    data = await r.json().catch(() => ({}));
  }
  if (status === 401 && path !== "/api/track/login") {
    sair(false);
  }
  return { ok: status >= 200 && status < 300, status, data: data ?? {} };
}

// ─── Login ─────────────────────────────────────────────────────────────────
async function entrar() {
  const username = $("username").value.trim();
  const password = $("password").value;
  $("loginErr").textContent = "";
  if (!username || !password) {
    $("loginErr").textContent = "Informe usuário e senha.";
    return;
  }
  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Entrando...";
  try {
    const r = await api("POST", "/api/track/login", { username, password });
    if (!r.ok || !r.data.token) {
      $("loginErr").textContent = mensagemDeErro(r.status, r.data.error);
      return;
    }
    localStorage.setItem(TOKEN_KEY, r.data.token);
    localStorage.setItem(NAME_KEY, r.data.nome || "");
    $("password").value = "";
    seguir();
  } catch (e) {
    $("loginErr").textContent =
      `Sem conexão com o servidor. ${e?.message ?? ""}`;
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Entrar";
  }
}

function seguir() {
  if (!localStorage.getItem(TOKEN_KEY)) return mostrar("loginView");
  if (localStorage.getItem(CONSENT_KEY) !== "1") return mostrar("consentView");
  mostrar("homeView");
  $("driverName").textContent = localStorage.getItem(NAME_KEY) || "";
  carregarViagens();
  conferirProtecao();
}

async function sair(revogar = true) {
  await pararRastreio();
  if (revogar && localStorage.getItem(TOKEN_KEY)) {
    // Revoga no servidor: aparelho perdido deixa de valer na hora.
    await api("POST", "/api/track/revoke", {}).catch(avisar);
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  mostrar("loginView");
}

// ─── Viagens ───────────────────────────────────────────────────────────────
async function carregarViagens() {
  $("tripsErr").textContent = "";
  $("tripsMsg").textContent = "Carregando suas viagens...";
  try {
    const r = await api("GET", "/api/track/viagens");
    if (!r.ok) {
      $("tripsMsg").textContent = "";
      $("tripsErr").textContent = mensagemDeErro(r.status, r.data.error);
      return;
    }
    const viagens = r.data.viagens ?? [];
    desenharViagens(viagens);
    await sincronizarRastreio(viagens);
  } catch (e) {
    $("tripsMsg").textContent = "";
    $("tripsErr").textContent =
      `Sem conexão. Toque em Atualizar. ${e?.message ?? ""}`;
  }
}

function el(tag, classe, texto) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto != null) n.textContent = texto; // textContent: nunca HTML (XSS)
  return n;
}

function botao(texto, classe, onClick) {
  const b = el("button", classe, texto);
  b.addEventListener("click", onClick);
  return b;
}

function desenharViagens(viagens) {
  const lista = $("tripsList");
  lista.replaceChildren();
  $("tripsMsg").textContent =
    viagens.length === 0 ? "Nenhuma viagem para você agora." : "";
  for (const v of viagens) lista.appendChild(cartaoViagem(v));
}

function cartaoViagem(v) {
  const card = el("div", "card trip");
  const topo = el("div", "row");
  topo.appendChild(el("strong", "", v.numeroViagem || `Viagem ${v.id}`));
  topo.appendChild(
    el(
      "span",
      v.status === "em_andamento" ? "pill on" : "pill",
      v.status === "em_andamento" ? "Em andamento" : "Planejada"
    )
  );
  card.appendChild(topo);
  card.appendChild(el("p", "rota", `${v.origem} → ${v.destino}`));
  card.appendChild(
    el("p", "muted", `Partida: ${formatarDataHora(v.dataPartida)}`)
  );
  if (v.carga) card.appendChild(el("p", "muted", `Carga: ${v.carga}`));
  if (Array.isArray(v.passageiros) && v.passageiros.length > 0) {
    card.appendChild(el("p", "muted", `Passageiros: ${v.passageiros.length}`));
  }

  const nav = el("div", "row gap");
  nav.appendChild(
    botao("Waze: origem", "sec", () => abrirExterno(wazeUrl(v.origem)))
  );
  nav.appendChild(
    botao("Waze: destino", "sec", () => abrirExterno(wazeUrl(v.destino)))
  );
  card.appendChild(nav);

  if (v.status === "planejada") {
    card.appendChild(botao("Iniciar viagem", "", e => iniciar(v.id, e)));
  }
  if (v.status === "em_andamento") {
    card.appendChild(el("label", "", "Data e hora de chegada no cliente"));
    const chegada = el("input");
    chegada.type = "datetime-local";
    chegada.value = agoraParaInput();
    card.appendChild(chegada);
    card.appendChild(
      botao("Concluir viagem", "", e => concluir(v.id, chegada.value, e))
    );
  }
  return card;
}

function abrirExterno(url) {
  // Endereço externo: o Capacitor não abre dentro do app — entrega ao Android,
  // que abre o Waze (ou o navegador, se o Waze não estiver instalado).
  window.location.href = url;
}

async function iniciar(id, ev) {
  const b = ev.currentTarget;
  b.disabled = true;
  b.textContent = "Iniciando...";
  try {
    const r = await api("POST", `/api/track/viagens/${id}/iniciar`, {});
    if (!r.ok) {
      $("tripsErr").textContent = mensagemDeErro(r.status, r.data.error);
    }
  } finally {
    await carregarViagens();
  }
}

async function concluir(id, valorChegada, ev) {
  const dataChegada = chegadaParaIso(valorChegada);
  if (!dataChegada) {
    $("tripsErr").textContent = "Informe a data e a hora de chegada.";
    return;
  }
  const b = ev.currentTarget;
  b.disabled = true;
  b.textContent = "Concluindo...";
  try {
    const r = await api("POST", `/api/track/viagens/${id}/concluir`, {
      dataChegada,
    });
    if (!r.ok) {
      $("tripsErr").textContent = mensagemDeErro(r.status, r.data.error);
    }
  } finally {
    await carregarViagens();
  }
}

// ─── GPS em segundo plano (plugin gratuito @capgo/background-geolocation) ──
async function sincronizarRastreio(viagens) {
  if (rastreioDeveEstarAtivo(viagens)) await ligarRastreio();
  else await pararRastreio();
}

async function ligarRastreio() {
  if (!isNative) {
    status(false, "O GPS em segundo plano só funciona no app instalado.");
    return;
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    // Reinicia limpo: o serviço pode ter sobrevivido a um fechamento do app.
    await BackgroundGeolocation.stop().catch(avisar);
    await BackgroundGeolocation.start(configRastreio(token), (loc, err) => {
      if (err) {
        if (err.code === "NOT_AUTHORIZED") {
          status(false, "Permita a localização para o rastreio funcionar.");
          $("permBtn").classList.remove("hidden");
        }
        return;
      }
      if (loc) {
        const hora = new Date().toLocaleTimeString("pt-BR");
        $("lastPing").textContent = `Última posição: ${hora}`;
      }
    });
    $("permBtn").classList.add("hidden");
    status(true, "Rastreando a viagem");
  } catch (e) {
    status(false, `Não foi possível ligar o GPS. ${e?.message ?? ""}`);
  }
}

async function pararRastreio() {
  if (isNative) await BackgroundGeolocation.stop().catch(avisar);
  status(false, "GPS desligado (sem viagem em andamento)");
}

function status(on, texto) {
  $("statusDot").classList.toggle("on", on);
  $("statusText").textContent = texto;
}

// ─── Proteção contra desinstalação (Device Admin, plugin próprio) ──────────
async function conferirProtecao() {
  if (!isNative) return;
  try {
    const { active } = await FraptoDeviceAdmin.isAdminActive();
    $("adminBtn").classList.toggle("hidden", active);
    $("adminActive").classList.toggle("hidden", !active);
  } catch (e) {
    // Plugin indisponível no aparelho: a tela segue sem o botão.
    avisar(e);
  }
}

// ─── Ligações ──────────────────────────────────────────────────────────────
$("loginBtn").addEventListener("click", entrar);
$("password").addEventListener("keydown", e => {
  if (e.key === "Enter") entrar();
});
$("consentBtn").addEventListener("click", () => {
  localStorage.setItem(CONSENT_KEY, "1");
  seguir();
});
$("consentLogout").addEventListener("click", () => sair());
$("logoutBtn").addEventListener("click", () => sair());
$("refreshBtn").addEventListener("click", carregarViagens);
$("permBtn").addEventListener("click", () =>
  BackgroundGeolocation.openSettings().catch(avisar)
);
$("settingsBtn").addEventListener("click", () =>
  BackgroundGeolocation.openSettings().catch(avisar)
);
$("adminBtn").addEventListener("click", async () => {
  await FraptoDeviceAdmin.requestAdmin().catch(avisar);
  setTimeout(conferirProtecao, 1000);
});
$("adminRemove").addEventListener("click", async () => {
  await FraptoDeviceAdmin.removeAdmin().catch(avisar);
  conferirProtecao();
});
// Voltou para o app (ex.: depois do Waze): atualiza viagens e o GPS.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && localStorage.getItem(TOKEN_KEY))
    carregarViagens();
});

seguir();
