import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: response => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: response.response },
      ]);
    },
    onError: error => {
      toast.error(error.message || "Erro ao falar com o assistente");
    },
  });

  const handleSend = (content: string) => {
    // Só enviamos user/assistant ao backend (o AIChatBox filtra system na exibição).
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    chatMutation.mutate({
      messages: next
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Assistente de Frota</h1>
          <p className="text-sm text-muted-foreground">
            Pergunte sobre veículos, motoristas, documentos vencendo e viagens.
          </p>
        </div>
      </div>

      <AIChatBox
        messages={messages}
        onSendMessage={handleSend}
        isLoading={chatMutation.isPending}
        placeholder="Ex: Quais CNHs vencem este mês?"
        emptyStateMessage="Como posso ajudar com a sua frota?"
        suggestedPrompts={[
          "Quais CNHs vencem nos próximos 30 dias?",
          "Quantos veículos estão em manutenção?",
          "Há manutenções pendentes?",
        ]}
        height="calc(100vh - 220px)"
      />
    </div>
  );
}
