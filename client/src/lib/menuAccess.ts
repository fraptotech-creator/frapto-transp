// Quem enxerga cada item do menu lateral. Função PURA — o gate de verdade é
// sempre no servidor (orgProcedure / orgOwnerProcedure / superAdminProcedure);
// isto aqui só evita mostrar link que daria erro.

export type MenuAccess = {
  adminOnly?: boolean;
  superAdminOnly?: boolean;
};

export type MenuViewer = {
  isSuperAdmin?: boolean;
  orgRole?: string | null;
  role?: string | null;
  // Super-admin SEM assinatura ativa: ele é o dono da plataforma, não um
  // cliente. Enxerga só a área da plataforma — o resto exigiria assinatura.
  somentePlataforma?: boolean;
};

export function podeVerItem(item: MenuAccess, viewer: MenuViewer): boolean {
  if (viewer.somentePlataforma) return item.superAdminOnly === true;
  if (item.superAdminOnly) return viewer.isSuperAdmin === true;
  if (item.adminOnly)
    return viewer.role === "admin" || viewer.orgRole === "owner";
  return true;
}
