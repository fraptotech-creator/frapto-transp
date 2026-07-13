import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { handleTrackIngest } from "../routers/trackHttp";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { handleWebhookEvent } from "./stripe";
import {
  securityHeaders,
  apiLimiter,
  authLimiter,
  originCheck,
} from "./security";

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
  // assinatura HMAC (fail-closed).
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
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
        console.error(
          "[Stripe] webhook error",
          err instanceof Error ? err.message : err
        );
        res.status(400).send("webhook error");
      }
    }
  );

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Healthcheck do Railway — precisa ficar ACIMA de tudo e sempre 200.
  app.get("/api/ping", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Ingestão de rastreio do app nativo (GPS em segundo plano). Autenticada por
  // token de motorista no corpo — NÃO usa cookie/Origin (é um cliente nativo,
  // não o browser), por isso fica fora do originCheck do /api/trpc. Rate-limit
  // geral por IP (cada aparelho tem seu IP; posta a cada ~15-30s).
  app.post("/api/track", apiLimiter, handleTrackIngest);

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
      // O cliente recebe a mensagem já saneada (ver errorFormatter); aqui
      // logamos o erro REAL para diagnóstico, sem perdê-lo.
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[tRPC] ${path ?? "?"} falhou:`, error.cause ?? error);
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
