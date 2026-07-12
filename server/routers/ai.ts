import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { activeOrgProcedure, orgOwnerProcedure, router } from "../_core/trpc";
import { getAiConfig, upsertAiConfig } from "../db";
import { invokeLLM, invokeOpenAIAgent, type ChatMessage } from "../_core/llm";
import { toOpenAiTools, runAiTool } from "../_core/aiTools";
import { assertSafeBaseUrl } from "../_core/urlSafety";
import {
  buildFleetContext,
  FLEET_ASSISTANT_SYSTEM,
  AGENT_SYSTEM,
  resolveAiConfig,
  sanitizeChatContent,
} from "./_helpers";

// Assistente de IA de frota. Somente leitura — informa, não muta.
export const aiRouter = router({
  chat: activeOrgProcedure
    .input(
      z.object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cfg = await resolveAiConfig(ctx.orgId);
      if (!cfg) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Assistente de IA não configurado. Configure o provedor e a chave em Configurações.",
        });
      }
      const messages: ChatMessage[] = input.messages.map(m => ({
        role: m.role,
        content: sanitizeChatContent(m.content),
      }));

      // GPT/Groq/compatível: AGENTE com ferramentas (consulta o sistema sob
      // demanda). Claude: contexto rico numa tacada (fora do loop de tools).
      if (cfg.provider === "anthropic") {
        const context = await buildFleetContext(ctx.orgId);
        const response = await invokeLLM(cfg, {
          system: FLEET_ASSISTANT_SYSTEM + context,
          messages,
        });
        return { response };
      }
      try {
        const response = await invokeOpenAIAgent(cfg, {
          system: AGENT_SYSTEM,
          messages,
          tools: toOpenAiTools(),
          runTool: (name, args) => runAiTool(ctx.orgId, name, args),
        });
        return { response };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = (e as { status?: number })?.status;
        // Rate limit do provedor (plano gratuito): mensagem clara, não "erro".
        if (
          status === 429 ||
          /rate limit|too many requests|\b429\b/i.test(msg)
        ) {
          return {
            response:
              "O assistente recebeu muitas solicitações agora (limite do plano gratuito). Aguarde alguns segundos e pergunte de novo.",
          };
        }
        throw e;
      }
    }),
});

// Configurações (dono da org). A chave da IA nunca volta ao browser.
export const settingsRouter = router({
  getAiConfig: orgOwnerProcedure.query(async ({ ctx }) => {
    const cfg = await getAiConfig(ctx.orgId);
    return {
      provider: cfg?.provider ?? ("anthropic" as const),
      model: cfg?.model ?? "",
      baseUrl: cfg?.baseUrl ?? "",
      enabled: cfg?.enabled ?? false,
      hasKey: Boolean(cfg?.apiKey),
      keyPreview: cfg?.apiKey ? `••••${cfg.apiKey.slice(-4)}` : "",
    };
  }),

  updateAiConfig: orgOwnerProcedure
    .input(
      z.object({
        provider: z.enum(["anthropic", "openai", "openai_compatible"]),
        model: z.string().optional(),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const data: {
        provider: "anthropic" | "openai" | "openai_compatible";
        model: string | null;
        baseUrl: string | null;
        enabled: boolean;
        apiKey?: string;
      } = {
        provider: input.provider,
        model: input.model?.trim() || null,
        baseUrl: input.baseUrl?.trim() || null,
        enabled: input.enabled,
      };
      // Anti-SSRF: a Base URL custom (openai_compatible) não pode apontar para
      // endereço interno/loopback/metadata.
      if (input.provider === "openai_compatible" && data.baseUrl) {
        try {
          await assertSafeBaseUrl(data.baseUrl);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Base URL inválida.",
          });
        }
      }
      if (input.apiKey && input.apiKey.trim().length > 0) {
        data.apiKey = input.apiKey.trim();
      }
      await upsertAiConfig(ctx.orgId, data);
      return { success: true } as const;
    }),
});
