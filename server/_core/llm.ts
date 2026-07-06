import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

// Assistente de frota via Claude (Anthropic) — substitui o forge do Manus.
export const LLM_MODEL = "claude-haiku-4-5";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!ENV.anthropicApiKey) {
    // Fail-closed: melhor erro visível do que resposta fabricada.
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return _client;
}

/**
 * Chama o Claude com um prompt de sistema e o histórico de mensagens.
 * Decisão pura fica em quem chama (montar o contexto); aqui só o efeito de rede.
 */
export async function invokeLLM(params: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map(block => block.text)
    .join("\n")
    .trim();
}
