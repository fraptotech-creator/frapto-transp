export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Inicia o fluxo de login Google. O returnPath leva o usuário de volta à rota
// atual após autenticar (validado no servidor contra open-redirect).
export const getLoginUrl = () => {
  const returnPath =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";
  return `/api/auth/google?return=${encodeURIComponent(returnPath)}`;
};
