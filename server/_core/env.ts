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
  // Assistente de IA (Anthropic Claude) — fallback legado.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Padrão de IA do SISTEMA (grátis pra todos): só a chave é obrigatória; o
  // resto já aponta pro Groq (OpenAI-compatível, rápido, sem cartão). Cada
  // empresa pode trocar em Configurações.
  defaultAiKey: process.env.DEFAULT_AI_KEY ?? "",
  defaultAiProvider: process.env.DEFAULT_AI_PROVIDER ?? "openai_compatible",
  defaultAiBaseUrl:
    process.env.DEFAULT_AI_BASE_URL ?? "https://api.groq.com/openai/v1",
  defaultAiModel: process.env.DEFAULT_AI_MODEL ?? "llama-3.3-70b-versatile",
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
