// Decisão PURA de quem é SUPER-ADMIN da plataforma (vê todas as empresas).
//
// Regra de ouro (lição de uma escalada de privilégio real em outro projeto):
// a identidade vem SEMPRE do REGISTRO do usuário no banco (openId + email),
// NUNCA de campo enviado pelo cliente. E é FAIL-CLOSED: se as variáveis de
// ambiente não estiverem setadas, NINGUÉM é admin.
//
// Exigimos os DOIS (openId estável gerado pelo servidor + email) porque só o
// email seria perigoso: se a conta ainda não existisse, um atacante poderia se
// cadastrar com esse email e virar admin.

export interface SuperAdminConfig {
  openId: string;
  email: string;
}

export function isSuperAdmin(
  user: { openId?: string | null; email?: string | null } | null | undefined,
  cfg: SuperAdminConfig
): boolean {
  // Env incompleta → ninguém é admin.
  if (!cfg.openId || !cfg.email) return false;
  if (!user?.openId || !user?.email) return false;
  return (
    user.openId === cfg.openId &&
    user.email.toLowerCase() === cfg.email.toLowerCase()
  );
}
