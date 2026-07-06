import { trpc } from "@/lib/trpc";

/**
 * Autenticação real via sessão (cookie JWT). auth.me é publicProcedure e
 * devolve o usuário logado ou null — não lança 401, então não há loop de
 * redirecionamento. O gate de login fica no DashboardLayout.
 */
export function useAuth() {
  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
  });

  return {
    user: user ?? null,
    loading: isLoading,
    error: error ?? null,
    isAuthenticated: !!user,
    refresh: () => utils.auth.me.invalidate(),
    logout: () => logoutMutation.mutateAsync(),
  };
}
