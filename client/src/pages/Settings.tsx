import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";

type Provider = "anthropic" | "openai" | "openai_compatible";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  openai_compatible: "Compatível com OpenAI (custom)",
};

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  openai_compatible: "",
};

export default function Settings() {
  const {
    data: config,
    isLoading,
    refetch,
  } = trpc.settings.getAiConfig.useQuery();
  const updateMutation = trpc.settings.updateAiConfig.useMutation();

  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Popula o formulário quando a config chega do servidor (a chave nunca vem).
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModel(config.model);
      setBaseUrl(config.baseUrl);
      setEnabled(config.enabled);
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        provider,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined, // vazio = mantém a chave atual
        enabled,
      });
      toast.success("Configuração de IA salva!");
      setApiKey("");
      refetch();
    } catch (error) {
      showErrorDialog(
        error instanceof Error ? error.message : "Erro ao salvar configuração",
        "Erro ao salvar configuração"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Provedor de IA do assistente de frota
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assistente de IA</CardTitle>
          <CardDescription>
            Escolha o provedor e informe a chave. A chave fica salva no servidor
            e nunca é exibida de volta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativar assistente</Label>
              <p className="text-xs text-muted-foreground">
                Desligado, a página do assistente fica indisponível.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select
              value={provider}
              onValueChange={v => setProvider(v as Provider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <Input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={
                DEFAULT_MODELS[provider]
                  ? `Padrão: ${DEFAULT_MODELS[provider]}`
                  : "Ex: gemini-2.5-flash"
              }
            />
          </div>

          {provider === "openai_compatible" && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.exemplo.com/v1"
              />
              <p className="text-xs text-muted-foreground">
                Endpoint compatível com a API da OpenAI (Gemini, DeepSeek,
                local…).
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Chave de API</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={
                config?.hasKey
                  ? `Chave salva (${config.keyPreview}) — deixe em branco para manter`
                  : "Cole a chave (sk-ant-… / sk-…)"
              }
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
