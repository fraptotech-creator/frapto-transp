// O motorista pode usar o app? Decisão PURA, usada em TODAS as bordas do
// motorista (login web, driverApp.*, login do app nativo e /api/track).
//
// Antes, marcar o motorista como "inativo" não mudava nada: ele seguia
// entrando, vendo viagens e mandando GPS (teste pré-venda 23/11/2026).
// Fail-closed: motorista não encontrado também não tem acesso. Reativar o
// cadastro devolve o acesso sem precisar de nova senha.
export const MOTORISTA_INATIVO_MSG =
  "Seu acesso foi desativado pela empresa. Fale com o seu gestor.";

export function motoristaComAcesso(
  driver: { status: string } | null | undefined
): boolean {
  return Boolean(driver) && driver?.status !== "inativo";
}
