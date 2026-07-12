import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Assistente de frota multi-provedor. A configuração (provedor/chave/modelo) é
// definida na tela de Configurações (admin) e persistida no banco — sem env var.
export type AiProvider = "anthropic" | "openai" | "openai_compatible";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AiRuntimeConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
};

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  openai_compatible: "Compatível com OpenAI (custom)",
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  openai_compatible: "",
};

async function invokeAnthropic(
  cfg: AiRuntimeConfig,
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const response = await client.messages.create({
    model: cfg.model || DEFAULT_MODELS.anthropic,
    max_tokens: maxTokens,
    system,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim();
}

async function invokeOpenAI(
  cfg: AiRuntimeConfig,
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL:
      cfg.baseUrl && cfg.baseUrl.trim().length > 0 ? cfg.baseUrl : undefined,
  });
  const response = await client.chat.completions.create({
    model: cfg.model || DEFAULT_MODELS.openai,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  });
  return (response.choices[0]?.message?.content ?? "").trim();
}

/**
 * Agente com FERRAMENTAS (só para provedores no formato OpenAI: GPT / Groq /
 * compatível). O modelo pode pedir para chamar funções (runTool); o servidor
 * executa, devolve o resultado e o loop segue até a resposta final. Teto de
 * passos evita loop infinito.
 */
export async function invokeOpenAIAgent(
  cfg: AiRuntimeConfig,
  params: {
    system: string;
    messages: ChatMessage[];
    tools: OpenAI.Chat.ChatCompletionTool[];
    runTool: (name: string, argsJson: string) => Promise<string>;
    maxTokens?: number;
    maxSteps?: number;
  }
): Promise<string> {
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL:
      cfg.baseUrl && cfg.baseUrl.trim().length > 0 ? cfg.baseUrl : undefined,
  });
  const model = cfg.model || DEFAULT_MODELS.openai;
  const maxTokens = params.maxTokens ?? 1024;
  const maxSteps = params.maxSteps ?? 5;
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: params.system },
    ...params.messages.map(m => ({ role: m.role, content: m.content })),
  ];

  for (let step = 0; step < maxSteps; step++) {
    const resp = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: msgs,
      tools: params.tools,
      tool_choice: "auto",
    });
    const msg = resp.choices[0]?.message;
    if (!msg) return "";
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      msgs.push(msg);
      // Responde a TODOS os tool_calls (os provedores exigem uma resposta por
      // id; faltar uma gera erro 400 na próxima chamada).
      for (const tc of msg.tool_calls) {
        const out =
          tc.type === "function"
            ? await params.runTool(tc.function.name, tc.function.arguments)
            : JSON.stringify({ erro: "tipo de ferramenta não suportado" });
        msgs.push({ role: "tool", tool_call_id: tc.id, content: out });
      }
      continue;
    }
    return (msg.content ?? "").trim();
  }
  // Estourou os passos: força a resposta em TEXTO. Mantém 'tools' (a conversa já
  // referencia tool_calls) mas proíbe novas chamadas com tool_choice:"none".
  const final = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: msgs,
    tools: params.tools,
    tool_choice: "none",
  });
  return (final.choices[0]?.message?.content ?? "").trim();
}

/**
 * Chama o provedor de IA configurado com um prompt de sistema + histórico.
 * Fail-closed: sem chave, lança erro visível (não fabrica resposta).
 */
export async function invokeLLM(
  cfg: AiRuntimeConfig,
  params: { system: string; messages: ChatMessage[]; maxTokens?: number }
): Promise<string> {
  if (!cfg.apiKey) {
    throw new Error(
      "Assistente de IA não configurado. Defina o provedor e a chave em Configurações."
    );
  }
  const maxTokens = params.maxTokens ?? 1024;
  if (cfg.provider === "anthropic") {
    return invokeAnthropic(cfg, params.system, params.messages, maxTokens);
  }
  // openai e openai_compatible usam o mesmo SDK (com baseURL custom no 2º caso).
  return invokeOpenAI(cfg, params.system, params.messages, maxTokens);
}
