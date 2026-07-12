export const ENV = {
  // Identificador do app embutido no JWT de sessão (assinado e verificado com o mesmo valor).
  appId: process.env.VITE_APP_ID ?? "frapto-transp",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Fail-closed: só é "development" quando NODE_ENV é EXATAMENTE "development".
  // Gates de rotas inseguras devem usar isDevelopment, não !isProduction (NODE_ENV
  // undefined cairia no ramo inseguro de !isProduction).
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  appBaseUrl: process.env.APP_BASE_URL ?? "",
  // Primeiro login com este email vira admin.
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  // Assistente de IA (Anthropic Claude)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
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
