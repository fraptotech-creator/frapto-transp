import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const demoUser = {
    id: "demo-user-001",
    name: "Administrador LogiMind",
    email: "admin@logimind.com",
    role: "admin"
  };

  return {
    user: demoUser,
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };
}
