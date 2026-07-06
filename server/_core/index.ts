import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleLoginRoutes } from "../googleAuthLogin";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

// Fail-closed: em produção, o app NÃO sobe sem os segredos essenciais.
// Erro visível no boot > sessão insegura silenciosa (JWT fraco / login quebrado).
function assertProductionSecrets() {
  if (!ENV.isProduction) return;
  const problems: string[] = [];
  if (ENV.cookieSecret.length < 32) {
    problems.push("JWT_SECRET ausente ou com menos de 32 caracteres");
  }
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    problems.push("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes");
  }
  if (!ENV.databaseUrl) {
    problems.push("DATABASE_URL ausente");
  }
  if (!ENV.appBaseUrl) {
    problems.push("APP_BASE_URL ausente (necessário para o callback OAuth)");
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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Healthcheck do Railway — precisa ficar ACIMA de tudo e sempre 200.
  app.get("/api/ping", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Login próprio via Google OAuth (rotas /api/auth/google[/callback])
  registerGoogleLoginRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
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
