import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    // httpLink (NÃO httpBatchLink): sem batching, cada chamada é 1 request. O
    // batch permitia amplificar N operações num único POST — o servidor também
    // recusa batch (allowBatching:false). Contenção fail-closed.
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Timeout de 120s para suportar chamadas longas (ex.: assistente de IA).
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        return globalThis
          .fetch(input, {
            ...(init ?? {}),
            credentials: "include",
            signal: init?.signal ?? controller.signal,
          })
          .finally(() => clearTimeout(timeoutId));
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
