import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import {
  handleTrackIngest,
  handleTrackLogin,
  handleTrackRevoke,
} from "../routers/trackHttp";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { handleWebhookEvent } from "./stripe";
import {
  securityHeaders,
  apiLimiter,
  authLimiter,
  originCheck,
  trackLimiter,
  trackIpBackstop,
  stripeWebhookLimiter,
} from "./security";
import { toSafeLogError } from "./safeLog";

// Fail-closed: em produção, o app NÃO sobe sem os segredos essenciais.
// Erro visível no boot > sessão insegura silenciosa (JWT fraco / login quebrado).
function assertProductionSecrets() {
  if (!ENV.isProduction) return;
  const problems: string[] = [];
  if (ENV.cookieSecret.length < 32) {
    problems.push("JWT_SECRET ausente ou com menos de 32 caracteres");
  }
  if (!ENV.databaseUrl) {
    problems.push("DATABASE_URL ausente");
  }
  if (!ENV.appBaseUrl) {
    problems.push("APP_BASE_URL ausente");
  }
  // Cifragem das chaves de IA em repouso: sem a chave, não dá para cifrar. Já
  // confirmado SET no Railway antes deste guard (não derruba a prod).
  if (!ENV.aiConfigEncryptionKey) {
    problems.push("AI_CONFIG_ENCRYPTION_KEY ausente");
  } else {
    try {
      if (Buffer.from(ENV.aiConfigEncryptionKey, "base64").length !== 32) {
        problems.push("AI_CONFIG_ENCRYPTION_KEY inválida (esperado 32 bytes)");
      }
    } catch {
      problems.push("AI_CONFIG_ENCRYPTION_KEY inválida (base64)");
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `[Boot] Configuração de produção inválida:\n- ${problems.join("\n- ")}`
    );
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertProductionSecrets();
  const app = express();
  const server = createServer(app);

  // Atrás do proxy do Railway: confia no 1º hop pra pegar o IP real (rate-limit).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Headers de segurança como 1º middleware.
  app.use(securityHeaders);

  // Webhook do Stripe ANTES do parser JSON: precisa do corpo CRU pra validar a
  // assinatura HMAC (fail-closed). Limiter próprio ALTO (compatível com os
  // retries do Stripe) na FRENTE + teto pequeno do corpo raw (o payload é
  // pequeno; evita amplificação). Assinatura inválida e erro de processamento
  // são logados SEPARADAMENTE (métrica por tag).
  app.post(
    "/api/stripe/webhook",
    stripeWebhookLimiter,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        res.status(400).send("missing signature");
        return;
      }
      try {
        await handleWebhookEvent(req.body as Buffer, sig);
        res.json({ received: true });
      } catch (err) {
        // Assinatura inválida (forjado/segredo errado) vs. falha de
        // processamento (DB/Stripe) — tags distintas para diagnóstico/alerta.
        const tag =
          (err as { type?: string })?.type ===
          "StripeSignatureVerificationError"
            ? "assinatura inválida"
            : "erro de processamento";
        console.error(`[Stripe] webhook ${tag}`, toSafeLogError(err));
        res.status(400).send("webhook error");
      }
    }
  );

  // ── Rastreio do app nativo — ANTES do parser global ───────────────────────
  // Autenticado por token no corpo (cliente nativo, sem cookie/Origin), fora
  // do originCheck do /api/trpc. O parser é DEDICADO e pequeno (64 KB): um POST
  // de rastreio nunca é grande (o app manda no máx. 500 pontos ≈ 30-40 KB). O
  // parser global de 15 MB (upload de documento) NÃO pode valer aqui, senão um
  // corpo enorme seria lido em memória antes de qualquer limite (DoS). Ordem:
  // trackIpBackstop (teto por IP, SEM parsear o corpo → barra flood antes) →
  // parser 64 KB → trackLimiter (por token, não trava frota atrás de CGNAT).
  const trackJson = express.json({ limit: "64kb" });
  app.post(
    "/api/track",
    trackIpBackstop,
    trackJson,
    trackLimiter,
    handleTrackIngest
  );
  // Login do app nativo: teto por IP antes de parsear + rate-limit estrito.
  app.post(
    "/api/track/login",
    trackIpBackstop,
    trackJson,
    authLimiter,
    handleTrackLogin
  );
  // Logout do app nativo: revoga o token no servidor (autenticado pelo token).
  app.post(
    "/api/track/revoke",
    trackIpBackstop,
    trackJson,
    trackLimiter,
    handleTrackRevoke
  );

  // Parser de corpo: 15 MB cobre o upload de documento (10 MB → ~13,3 MB em
  // base64) com folga; era 50 MB (4× o necessário) — reduz amplificação de DoS
  // por corpo grande nas rotas públicas. Form urlencoded é minúsculo (100 KB).
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));
  // Healthcheck do Railway — precisa ficar ACIMA de tudo e sempre 200.
  app.get("/api/ping", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // Login (email+senha) é via tRPC (auth.signup / auth.login).
  // Rate-limit ESTRITO no login/cadastro (anti brute-force), antes do geral.
  app.use(["/api/trpc/auth.login", "/api/trpc/auth.signup"], authLimiter);
  // tRPC API: rate-limit geral + checagem de Origin (CSRF).
  app.use(
    "/api/trpc",
    apiLimiter,
    originCheck,
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Sem batching no servidor: um POST não pode carregar N operações (o
      // rate-limit HTTP conta requests, não efeitos — batch furava esse teto).
      // O cliente usa httpLink; aqui é o enforce fail-closed.
      allowBatching: false,
      // O cliente recebe a mensagem já saneada (ver errorFormatter); aqui
      // logamos o erro REAL para diagnóstico, sem perdê-lo.
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          // NUNCA logar error.cause cru: numa falha de DB é o SQL + os
          // PARÂMETROS (CPF/telefone/e-mail). Só a classe/código do erro.
          console.error(
            `[tRPC] ${path ?? "?"} falhou:`,
            toSafeLogError(error.cause ?? error)
          );
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // Em produção o Railway injeta PORT e o healthcheck bate NELA — não podemos
  // pular para outra porta. Só varremos portas livres em desenvolvimento.
  const port = ENV.isProduction
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
