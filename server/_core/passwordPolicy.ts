// Política de senha centralizada, para não divergir entre fluxos (signup,
// troca, reset). Antes: signup exigia 8, troca exigia 6, reset exigia 8.

export const SENHA_MIN = 8;

export function senhaAtendeMinimo(s: string): boolean {
  return typeof s === "string" && s.length >= SENHA_MIN;
}

/**
 * Motorista com senha temporária (mustChangePassword) fica travado no servidor:
 * só pode trocar a senha e sair. É o gate de VERDADE — a tela React apenas
 * espelha isto; segurança não pode depender do cliente.
 */
export function exigeTrocaDeSenha(
  user: { mustChangePassword?: boolean | null } | null | undefined
): boolean {
  return user?.mustChangePassword === true;
}
