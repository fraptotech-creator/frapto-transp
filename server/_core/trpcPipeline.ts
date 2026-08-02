import type { Express, RequestHandler } from "express";
import { originCheck } from "./security";
import { trpcCanonicalGate } from "./trpcCanonical";
import { uploadGate } from "./uploadGate";
import { makeTrpcParserSelector } from "./uploadCapability";

export interface TrpcPipelineDeps {
  // Rate-limit ESTRITO de login/cadastro (anti brute-force).
  authLimiter: RequestHandler;
  // Rate-limit GERAL por IP — backstop antes de auth/logs/parser.
  apiLimiter: RequestHandler;
  // Parser PEQUENO (128 KB) — padrão de toda procedure.
  smallParser: RequestHandler;
  // Parser GRANDE (15 MB) — só o upload, e só com capacidade concedida.
  uploadParser: RequestHandler;
  // Adapter tRPC (com createContext + allowBatching:false).
  adapter: RequestHandler;
}

// Monta a cadeia /api/trpc na ORDEM fail-closed. FÁBRICA ÚNICA usada pela
// produção E pelos testes — o mesmo pipeline real, sem wiring divergente (os
// testes unitários com mocks não pegavam os bypasses de método/path). Ordem:
//
//   [auth.login / auth.signup] → authLimiter (estrito, antes de tudo)
//   /api/trpc:
//     1. trpcCanonicalGate  → rejeita alias / barra dupla / trailing / %2F
//                             (404) ANTES do adapter; grava a procedure canônica
//     2. apiLimiter         → teto por IP (backstop antes de auth/logs/parser)
//     3. originCheck        → CSRF (Origin ≠ APP_BASE_URL → 403)
//     4. uploadGate         → só no path de upload: backstop IP + POST + sessão
//                             ATIVA + rate/concorrência por usuário + concede a
//                             capacidade interna
//     5. seletor de parser  → 15 MB SÓ com POST + path canônico + capacidade;
//                             senão 128 KB (o tamanho grande nunca vem de path)
//     6. adapter tRPC
export function mountTrpcPipeline(app: Express, deps: TrpcPipelineDeps): void {
  // Login (email+senha) e cadastro via tRPC: rate-limit estrito antes do geral.
  app.use(["/api/trpc/auth.login", "/api/trpc/auth.signup"], deps.authLimiter);
  app.use(
    "/api/trpc",
    trpcCanonicalGate,
    deps.apiLimiter,
    originCheck,
    uploadGate,
    makeTrpcParserSelector(deps.smallParser, deps.uploadParser),
    deps.adapter
  );
}
