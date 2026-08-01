// Decisão PURA de boot fail-closed. Em produção (Railway OU NODE_ENV=production)
// exige NODE_ENV EXATO "production" e todos os segredos; qualquer falta/erro NEGA
// o boot (erro visível > sessão insegura silenciosa). Fora disso = dev local,
// que sobe sem exigir segredos. Testável sem processo real.

export type BootEnv = {
  nodeEnv: string | undefined;
  // RAILWAY_ENVIRONMENT_ID presente = rodando no Railway (produção real).
  onRailway: boolean;
  jwtSecretLen: number;
  hasDatabaseUrl: boolean;
  hasAppBaseUrl: boolean;
  // Bytes decodificados de AI_CONFIG_ENCRYPTION_KEY (0 se ausente/invalida).
  aiKeyBytes: number;
};

export type BootDecision =
  | { ok: true; mode: "production" | "development" }
  | { ok: false; problems: string[] };

export function decideBoot(env: BootEnv): BootDecision {
  // Intenção de produção: no Railway SEMPRE; ou NODE_ENV=production em qualquer
  // host. Sem nenhum sinal → tratamos como desenvolvimento local (sobe).
  const prodIntent = env.onRailway || env.nodeEnv === "production";
  if (!prodIntent) {
    return { ok: true, mode: "development" };
  }

  const problems: string[] = [];
  // NODE_ENV DEVE ser exatamente "production": os gates de segurança usam
  // `=== "production"`; ausente/errado os faria falhar ABERTO. No Railway isso
  // nega o boot (força corrigir a env).
  if (env.nodeEnv !== "production") {
    problems.push(
      `NODE_ENV precisa ser "production" (atual: ${
        env.nodeEnv === undefined ? "ausente" : `"${env.nodeEnv}"`
      })`
    );
  }
  if (env.jwtSecretLen < 32) {
    problems.push("JWT_SECRET ausente ou com menos de 32 caracteres");
  }
  if (!env.hasDatabaseUrl) problems.push("DATABASE_URL ausente");
  if (!env.hasAppBaseUrl) problems.push("APP_BASE_URL ausente");
  if (env.aiKeyBytes !== 32) {
    problems.push("AI_CONFIG_ENCRYPTION_KEY ausente ou inválida (32 bytes)");
  }

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, mode: "production" };
}
