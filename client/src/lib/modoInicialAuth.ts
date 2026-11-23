// Qual tela o visitante deslogado vê primeiro. Decisão PURA.
//
// O callback do Google devolve as falhas para /login?error=<código>, mas
// /login abria a landing de marketing: o aviso ("este e-mail já tem cadastro
// com senha", etc.) só aparecia se a pessoa clicasse em "Entrar" — quem não
// clicava achava que nada tinha acontecido (teste pré-venda 23/11/2026).
export function modoInicialAuth(
  pathname: string,
  search: string
): "login" | null {
  if (pathname === "/login") return "login";
  if (new URLSearchParams(search).has("error")) return "login";
  return null;
}
