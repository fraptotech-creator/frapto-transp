export const ENV = {
  // Identificador do app embutido no JWT de sessão (assinado e verificado com o mesmo valor).
  appId: process.env.VITE_APP_ID ?? "frapto-transp",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Fail-closed: comparação EXATA com "production". Se algum gate de rota
  // insegura for adicionado, teste `NODE_ENV === "development"` explicitamente —
  // com `!isProduction`, NODE_ENV indefinido cairia no ramo INSEGURO.
  isProduction: process.env.NODE_ENV === "production",
  appBaseUrl: process.env.APP_BASE_URL ?? "",
  // Sinal CONFIÁVEL de que estamos no Railway (injetado pela plataforma em toda
  // réplica). Usado pelo boot-guard: no Railway, NODE_ENV ausente/errado NEGA o
  // boot (senão os gates `=== "production"` cairiam no ramo inseguro).
  railwayEnvironmentId: process.env.RAILWAY_ENVIRONMENT_ID ?? "",
  // SUPER-ADMIN da plataforma (vê todas as empresas). Gate por identidade do
  // REGISTRO (openId estável + email), nunca por input do cliente. Os DOIS
  // precisam estar setados e bater — vazio = NINGUÉM é admin (fail-closed).
  superAdminOpenId: process.env.SUPER_ADMIN_OPEN_ID ?? "",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL ?? "",
  // E-mail transacional (Resend) — hoje só recuperação de senha.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // Remetente. Precisa ser do domínio verificado no Resend, senão ele recusa.
  emailRemetente:
    process.env.EMAIL_REMETENTE ?? "nao-responda@fraptotransp.com.br",
  // Assistente de IA — CHAVE-PADRÃO DO SISTEMA (fallback quando a empresa não
  // configurou a própria). ATENÇÃO LGPD: a IA lê dados reais do cliente
  // (veículos/motoristas/viagens/financeiro); com estas vars setadas, os dados
  // de QUALQUER empresa sem config própria passam por esta chave compartilhada.
  // Vazio = sem fallback (fail-closed, a org precisa configurar em Configurações).
  // DEFAULT_AI_* costuma apontar p/ um provedor OpenAI-compatível grátis (Groq).
  defaultAiKey: process.env.DEFAULT_AI_KEY ?? "",
  defaultAiProvider: process.env.DEFAULT_AI_PROVIDER ?? "openai_compatible",
  defaultAiBaseUrl:
    process.env.DEFAULT_AI_BASE_URL ?? "https://api.groq.com/openai/v1",
  // Modelo-padrão do fallback. O Groq DESCONTINUOU llama-3.3-70b-versatile e
  // llama-3.1-8b-instant no tier grátis/dev em 17/06/2026; a migração indicada
  // p/ o 70b é openai/gpt-oss-120b (suporta tool calling, exigido pelo agente).
  // Se o Groq aposentar este também, sobrescreva via env DEFAULT_AI_MODEL.
  defaultAiModel: process.env.DEFAULT_AI_MODEL ?? "openai/gpt-oss-120b",
  // Anthropic Claude — fallback legado (2ª opção de chave-padrão).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Chave (32 bytes base64) para cifrar a apiKey de IA de cada empresa em
  // repouso (AES-256-GCM). Vazia = escrita cifrada indisponível (fail-closed).
  aiConfigEncryptionKey: process.env.AI_CONFIG_ENCRYPTION_KEY ?? "",
  // Stripe (paywall / assinatura)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
  // OpenRouteService (geocoder/rotas melhores — chave grátis, sem cartão).
  // Vazio = usa OpenStreetMap público (Nominatim/OSRM) como padrão.
  orsApiKey: process.env.ORS_API_KEY ?? "",
  // Cloudflare R2 (upload de documentos)
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "",
};
