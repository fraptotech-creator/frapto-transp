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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";

// Espelha NOTIF_LIMITS do servidor (server/_core/notifications.ts).
const LIM = { diasMin: 1, diasMax: 365, oleoMin: 1, oleoMax: 50 };

type NotifSettings = {
  cnhEnabled: boolean;
  cnhDiasAntes: number;
  crlvEnabled: boolean;
  crlvDiasAntes: number;
  manutencaoEnabled: boolean;
  manutencaoDiasAntes: number;
  oleoEnabled: boolean;
  oleoPercentAntes: number;
  documentosEnabled: boolean;
  documentosDiasAntes: number;
  urgenciaAltaDiasAntes: number;
};

const DEFAULTS: NotifSettings = {
  cnhEnabled: true,
  cnhDiasAntes: 30,
  crlvEnabled: true,
  crlvDiasAntes: 30,
  manutencaoEnabled: true,
  manutencaoDiasAntes: 7,
  oleoEnabled: true,
  oleoPercentAntes: 10,
  documentosEnabled: true,
  documentosDiasAntes: 30,
  urgenciaAltaDiasAntes: 7,
};

// Linha: liga/desliga + um número (dias ou %). Componente de módulo (não recria
// a cada render → o input não perde o foco ao digitar).
function LinhaConfig(props: {
  label: string;
  hint: string;
  enabled: boolean;
  onEnabled: (b: boolean) => void;
  value: number;
  onValue: (n: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{props.label}</Label>
          <p className="text-xs text-muted-foreground">{props.hint}</p>
        </div>
        <Switch checked={props.enabled} onCheckedChange={props.onEnabled} />
      </div>
      {props.enabled && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={props.min}
            max={props.max}
            value={props.value}
            onChange={e => props.onValue(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">{props.unit}</span>
        </div>
      )}
    </div>
  );
}

export default function NotificacoesCard() {
  const { data, isLoading, refetch } =
    trpc.settings.getNotificationSettings.useQuery();
  const update = trpc.settings.updateNotificationSettings.useMutation();
  const [s, setS] = useState<NotifSettings>(DEFAULTS);

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const set = (patch: Partial<NotifSettings>) =>
    setS(prev => ({ ...prev, ...patch }));

  const clampDias = (n: number) =>
    Math.min(LIM.diasMax, Math.max(LIM.diasMin, Math.round(n || 0)));
  const clampOleo = (n: number) =>
    Math.min(LIM.oleoMax, Math.max(LIM.oleoMin, Math.round(n || 0)));

  const handleSave = async () => {
    // Sanitiza para dentro dos limites antes de enviar (o servidor revalida).
    const payload: NotifSettings = {
      ...s,
      cnhDiasAntes: clampDias(s.cnhDiasAntes),
      crlvDiasAntes: clampDias(s.crlvDiasAntes),
      manutencaoDiasAntes: clampDias(s.manutencaoDiasAntes),
      documentosDiasAntes: clampDias(s.documentosDiasAntes),
      urgenciaAltaDiasAntes: clampDias(s.urgenciaAltaDiasAntes),
      oleoPercentAntes: clampOleo(s.oleoPercentAntes),
    };
    try {
      await update.mutateAsync(payload);
      setS(payload);
      toast.success("Notificações salvas!");
      refetch();
    } catch (error) {
      showErrorDialog(
        error instanceof Error ? error.message : "Erro ao salvar",
        "Erro ao salvar notificações"
      );
    }
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações</CardTitle>
        <CardDescription>
          Escolha quais alertas aparecem e com quanta antecedência (dias antes
          do vencimento). Vale para o painel e a aba Notificações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LinhaConfig
          label="CNH de motorista vencendo"
          hint="Avisar quando a CNH vence dentro de N dias."
          enabled={s.cnhEnabled}
          onEnabled={b => set({ cnhEnabled: b })}
          value={s.cnhDiasAntes}
          onValue={n => set({ cnhDiasAntes: n })}
          min={LIM.diasMin}
          max={LIM.diasMax}
          unit="dias antes"
        />
        <LinhaConfig
          label="CRLV de veículo vencendo"
          hint="Avisar quando o CRLV vence dentro de N dias."
          enabled={s.crlvEnabled}
          onEnabled={b => set({ crlvEnabled: b })}
          value={s.crlvDiasAntes}
          onValue={n => set({ crlvDiasAntes: n })}
          min={LIM.diasMin}
          max={LIM.diasMax}
          unit="dias antes"
        />
        <LinhaConfig
          label="Manutenção agendada"
          hint="Avisar quando uma manutenção pendente está a N dias."
          enabled={s.manutencaoEnabled}
          onEnabled={b => set({ manutencaoEnabled: b })}
          value={s.manutencaoDiasAntes}
          onValue={n => set({ manutencaoDiasAntes: n })}
          min={LIM.diasMin}
          max={LIM.diasMax}
          unit="dias antes"
        />
        <LinhaConfig
          label="Documentos vencendo"
          hint="Avisar quando um documento (seguro, etc.) vence dentro de N dias."
          enabled={s.documentosEnabled}
          onEnabled={b => set({ documentosEnabled: b })}
          value={s.documentosDiasAntes}
          onValue={n => set({ documentosDiasAntes: n })}
          min={LIM.diasMin}
          max={LIM.diasMax}
          unit="dias antes"
        />
        <LinhaConfig
          label="Troca de óleo"
          hint="Avisar quando faltar essa % do intervalo de troca (por km)."
          enabled={s.oleoEnabled}
          onEnabled={b => set({ oleoEnabled: b })}
          value={s.oleoPercentAntes}
          onValue={n => set({ oleoPercentAntes: n })}
          min={LIM.oleoMin}
          max={LIM.oleoMax}
          unit="% do intervalo"
        />

        <div className="space-y-2 rounded-lg border p-3">
          <Label>Urgência alta</Label>
          <p className="text-xs text-muted-foreground">
            Alertas por data com vencimento em até N dias (ou já vencidos) são
            marcados como <strong>urgência alta</strong> (vermelho).
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={LIM.diasMin}
              max={LIM.diasMax}
              value={s.urgenciaAltaDiasAntes}
              onChange={e =>
                set({ urgenciaAltaDiasAntes: Number(e.target.value) })
              }
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">dias ou menos</span>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={update.isPending}
          className="w-full"
        >
          {update.isPending ? "Salvando…" : "Salvar notificações"}
        </Button>
      </CardContent>
    </Card>
  );
}
