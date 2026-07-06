import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Bell, Clock, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Notifications() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  const criticalAlerts =
    stats?.alerts?.filter(
      (a: any) => a.urgency === "alta" || a.type === "cnh"
    ) || [];
  const warningAlerts =
    stats?.alerts?.filter(
      (a: any) => a.urgency === "media" && a.type !== "cnh"
    ) || [];

  return (
    <div className="p-6 space-y-8 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl glow-effect">
          <Bell className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Central de Notificações
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Alertas e atualizações do sistema em tempo real
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Alertas Críticos */}
        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              Alertas Críticos
            </CardTitle>
            <CardDescription className="text-gray-400">
              Ações imediatas necessárias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {criticalAlerts.length > 0 ? (
              criticalAlerts.map((alert: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-red-900/20 border border-red-500/30 backdrop-blur-xl transition-all hover:bg-red-900/30"
                >
                  <div className="p-2 rounded-xl bg-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-bold text-red-100">{alert.title}</p>
                    <p className="text-sm text-red-200/70 mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4 italic">
                Nenhum alerta crítico no momento.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Alertas de Atenção */}
        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-amber-400">
              <Clock className="w-5 h-5" />
              Atenção e Prazos
            </CardTitle>
            <CardDescription className="text-gray-400">
              Monitoramento de documentos e manutenções
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {warningAlerts.length > 0 ? (
              warningAlerts.map((alert: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-amber-900/20 border border-amber-500/30 backdrop-blur-xl transition-all hover:bg-amber-900/30"
                >
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-100">{alert.title}</p>
                    <p className="text-sm text-amber-200/70 mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4 italic">
                Nenhum alerta de atenção no momento.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notificações Gerais */}
        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-400">
              <Info className="w-5 h-5" />
              Atividades Recentes
            </CardTitle>
            <CardDescription className="text-gray-400">
              Histórico de operações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-900/20 border border-blue-500/30 backdrop-blur-xl transition-all hover:bg-blue-900/30">
              <div className="p-2 rounded-xl bg-blue-500/20">
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-blue-100">Sistema Atualizado</p>
                <p className="text-sm text-blue-200/70 mt-1">
                  O design Dark Premium foi aplicado com sucesso em todo o
                  sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
