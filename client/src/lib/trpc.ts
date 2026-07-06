import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

// Cliente tRPC real, tipado pelo AppRouter do servidor.
// (Substitui o mock em memória usado na pré-visualização Manus.)
export const trpc = createTRPCReact<AppRouter>();
