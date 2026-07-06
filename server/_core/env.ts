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
  // Google OAuth (login próprio, sem intermediário Manus)
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "",
  // Primeiro login com este email vira admin.
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  // Assistente de IA (Anthropic Claude)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // [LEGADO Manus] ainda lidos por llm.ts/storage.ts — removidos na Fase 4 (IA) / limpeza.
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
