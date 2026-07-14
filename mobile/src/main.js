import { Capacitor, CapacitorHttp } from "@capacitor/core";
import BackgroundGeolocation from "@transistorsoft/capacitor-background-geolocation";
import { FraptoDeviceAdmin } from "frapto-device-admin";

// Servidor de produção do Frapto Transp.
const BASE = "https://frapto-transp-production.up.railway.app";
const TOKEN_KEY = "frapto_track_token";
const NAME_KEY = "frapto_track_name";
const CONSENT_KEY = "frapto_track_consent";

const $ = id => document.getElementById(id);
const isNative = Capacitor.isNativePlatform();

// ─── Telas ────────────────────────────────────────────────────────────────
function hideAll() {
  $("loginView").classList.add("hidden");
  $("consentView").classList.add("hidden");
  $("trackView").classList.add("hidden");
}
function showLogin() {
  hideAll();
  $("loginView").classList.remove("hidden");
}
function showConsent() {
  hideAll();
  $("consentView").classList.remove("hidden");
}
function showTrack() {
  hideAll();
  $("trackView").classList.remove("hidden");
  $("driverName").textContent = localStorage.getItem(NAME_KEY) || "";
}

// Após logar (ou sessão salva): só vai pro rastreio se já aceitou o termo.
function proceedAfterLogin() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (localStorage.getItem(CONSENT_KEY) !== "1") {
    showConsent();
    return;
  }
  showTrack();
  if (token) configureTracking(token);
}

function setStatus(on, text) {
  $("statusDot").classList.toggle("on", on);
  $("statusText").textContent = text;
  $("startBtn").classList.toggle("hidden", on);
  $("stopBtn").classList.toggle("hidden", !on);
}

// POST em JSON. No app nativo usa CapacitorHttp (rede nativa, sem CORS); no
// navegador (dev) usa fetch. Retorna { ok, status, data }.
async function apiPost(path, body) {
  const url = `${BASE}${path}`;
  if (isNative) {
    const res = await CapacitorHttp.post({
      url,
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    let data = res.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        /* deixa como string */
      }
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      data,
    };
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// ─── Login (REST, sem tRPC) ─────────────────────────────────────────────────
async function doLogin() {
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
    const r = await apiPost("/api/track/login", { username, password });
    const data = r.data || {};
    if (!r.ok || !data.token) {
      $("loginErr").textContent =
        data.error || `Falha ao entrar (HTTP ${r.status}).`;
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(NAME_KEY, data.nome || "");
    proceedAfterLogin();
  } catch (e) {
    // Mostra o erro REAL pra diagnóstico (rede/CORS/URL/TLS).
    const msg = e && e.message ? e.message : String(e);
    $("loginErr").textContent = `Erro: ${msg}`;
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Entrar";
  }
}

// ─── Rastreio em segundo plano (nativo) ─────────────────────────────────────
let configured = false;

async function configureTracking(token) {
  if (!isNative) {
    setStatus(false, "Só funciona no app instalado (Android).");
    $("startBtn").disabled = true;
    return;
  }
  if (configured) {
    await BackgroundGeolocation.setConfig({ params: { token } });
    return;
  }
  const state = await BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 50, // metros entre pontos (menos requisições)
    stopOnTerminate: false, // continua se o app for fechado
    startOnBoot: true, // volta após reiniciar o celular
    foregroundService: true,
    // Envia a posição direto ao servidor (nativo), mesmo com o app fechado.
    url: `${BASE}/api/track`,
    // Agrupa várias posições num POST só (bem menos requisições). O servidor
    // lê o campo "location" (objeto único ou array).
    httpRootProperty: "location",
    locationTemplate:
      '{"lat":<%= latitude %>,"lng":<%= longitude %>,"speed":<%= speed %>}',
    params: { token },
    autoSync: true,
    batchSync: true,
    autoSyncThreshold: 5,
    maxBatchSize: 50,
    notification: {
      title: "Frapto Transp",
      text: "Rastreamento ativo",
    },
    debug: false,
    logLevel: BackgroundGeolocation.LOG_LEVEL_ERROR,
  });
  configured = true;

  BackgroundGeolocation.onLocation(loc => {
    const t = new Date().toLocaleTimeString("pt-BR");
    $("lastPing").textContent = `Última posição enviada: ${t}`;
  });
  BackgroundGeolocation.onEnabledChange(enabled => {
    setStatus(enabled, enabled ? "Rastreando" : "Parado");
  });

  setStatus(state.enabled, state.enabled ? "Rastreando" : "Parado");
  checkBattery();
  checkAdmin();
}

// Otimização de bateria: se o Android estiver otimizando o app, o serviço pode
// ser morto. Mostra o aviso/botão só quando NÃO está isento.
async function checkBattery() {
  if (!isNative) return;
  try {
    const ok =
      await BackgroundGeolocation.deviceSettings.isIgnoringBatteryOptimizations();
    $("batteryCard").classList.toggle("hidden", ok);
  } catch {
    /* API pode não existir no aparelho — ignora */
  }
}

async function fixBattery() {
  try {
    const req =
      await BackgroundGeolocation.deviceSettings.showIgnoreBatteryOptimizations();
    await BackgroundGeolocation.deviceSettings.show(req);
    setTimeout(checkBattery, 1500);
  } catch {
    /* usuário pode ter cancelado */
  }
}

// Proteção contra desinstalação (Device Admin). Mostra o botão de ativar ou o
// aviso de "ativa + liberar", conforme o estado atual.
async function checkAdmin() {
  if (!isNative) return;
  try {
    const { active } = await FraptoDeviceAdmin.isAdminActive();
    $("adminBtn").classList.toggle("hidden", active);
    $("adminActive").classList.toggle("hidden", !active);
  } catch {
    /* plugin indisponível — ignora */
  }
}

async function activateAdmin() {
  try {
    await FraptoDeviceAdmin.requestAdmin();
    // O usuário volta da tela do sistema; reconfere ao focar de novo.
    setTimeout(checkAdmin, 1000);
  } catch {
    /* ignora */
  }
}

async function removeAdminProtection() {
  try {
    await FraptoDeviceAdmin.removeAdmin();
    checkAdmin();
  } catch {
    /* ignora */
  }
}

async function startTracking() {
  $("trackErr").textContent = "";
  try {
    await BackgroundGeolocation.start();
    setStatus(true, "Rastreando");
  } catch (e) {
    $("trackErr").textContent = "Não foi possível iniciar o rastreio.";
  }
}

async function stopTracking() {
  try {
    await BackgroundGeolocation.stop();
    setStatus(false, "Parado");
  } catch (e) {
    /* ignora */
  }
}

function logout() {
  stopTracking();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  $("username").value = "";
  $("password").value = "";
  showLogin();
}

// ─── Ligações ───────────────────────────────────────────────────────────────
$("loginBtn").addEventListener("click", doLogin);
$("password").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
$("startBtn").addEventListener("click", startTracking);
$("stopBtn").addEventListener("click", stopTracking);
$("logoutBtn").addEventListener("click", logout);
$("batteryBtn").addEventListener("click", fixBattery);
$("adminBtn").addEventListener("click", activateAdmin);
$("adminRemove").addEventListener("click", removeAdminProtection);
$("consentBtn").addEventListener("click", () => {
  localStorage.setItem(CONSENT_KEY, "1");
  proceedAfterLogin();
});
$("consentLogout").addEventListener("click", logout);

// Sessão salva → decide entre termo e rastreio.
if (localStorage.getItem(TOKEN_KEY)) {
  proceedAfterLogin();
} else {
  showLogin();
}
