import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripDialog, TripActions } from "@/components/TripForms";
import { formatPlaca } from "@/lib/format";
import {
  MapPin,
  Navigation,
  Truck,
  Clock,
  Route,
  Play,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Trips() {
  const { data: trips, isLoading } = trpc.trips.list.useQuery();
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const { data: drivers } = trpc.drivers.list.useQuery();
  const [, setLocation] = useLocation();

  const getStatusConfig = (status: string) => {
    const configs: Record<
      string,
      { bg: string; text: string; icon: any; label: string; dot: string }
    > = {
      planejada: {
        bg: "bg-blue-500/10 border-blue-500/20",
        text: "text-blue-400",
        icon: Clock,
        label: "Planejada",
        dot: "bg-blue-400",
      },
      em_andamento: {
        bg: "bg-indigo-500/10 border-indigo-500/20",
        text: "text-indigo-400",
        icon: Navigation,
        label: "Em Trânsito",
        dot: "bg-indigo-400 animate-pulse",
      },
      concluida: {
        bg: "bg-emerald-500/10 border-emerald-500/20",
        text: "text-emerald-400",
        icon: CheckCircle2,
        label: "Concluída",
        dot: "bg-emerald-400",
      },
      cancelada: {
        bg: "bg-red-500/10 border-red-500/20",
        text: "text-red-400",
        icon: XCircle,
        label: "Cancelada",
        dot: "bg-red-400",
      },
    };
    return configs[status] || configs.planejada;
  };

  const getVehicle = (id: number) => vehicles?.find((v: any) => v.id === id);
  const getDriver = (id: number) => drivers?.find((d: any) => d.id === id);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl glow-effect-purple">
            <Route className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Viagens
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerenciar rotas e rastreamento
            </p>
          </div>
        </div>
        <TripDialog />
      </div>

      {/* Stats Row */}
      {trips && trips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
            <p className="text-2xl font-bold text-white">{trips.length}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              Total
            </p>
          </div>
          <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20 text-center">
            <p className="text-2xl font-bold text-indigo-400">
              {trips.filter((t: any) => t.status === "em_andamento").length}
            </p>
            <p className="text-[10px] text-indigo-300/60 uppercase tracking-wider">
              Em Trânsito
            </p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {trips.filter((t: any) => t.status === "planejada").length}
            </p>
            <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">
              Planejadas
            </p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {trips.filter((t: any) => t.status === "concluida").length}
            </p>
            <p className="text-[10px] text-emerald-300/60 uppercase tracking-wider">
              Concluídas
            </p>
          </div>
        </div>
      )}

      {/* Trip List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : trips && trips.length > 0 ? (
        <div className="space-y-3">
          {trips.map((trip: any) => {
            const config = getStatusConfig(trip.status);
            const StatusIcon = config.icon;
            const vehicle = getVehicle(trip.veiculoId);
            const driver = getDriver(trip.motoristaId);

            return (
              <Card
                key={trip.id}
                className={`border ${config.bg} glass-card hover:border-white/20 transition-all duration-300 cursor-pointer group`}
                onClick={() => setLocation(`/trips/${trip.id}/tracking`)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Route Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.bg} ${config.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
                          />
                          {config.label}
                        </span>
                        <span className="text-[10px] text-white/30 font-mono">
                          #{trip.numeroViagem}
                        </span>
                      </div>

                      {/* Route visualization */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                          <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-400/50 to-indigo-400/50 rounded-full" />
                          <div className="w-2.5 h-2.5 rounded-sm bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {trip.origem}
                          </p>
                          <div className="my-1" />
                          <p className="text-sm font-bold text-white truncate">
                            {trip.destino}
                          </p>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-4 text-[11px] text-white/40">
                        {vehicle && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />{" "}
                            {formatPlaca(vehicle.placa)}
                          </span>
                        )}
                        {driver && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {driver.nome}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(trip.dataPartida).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right: Action */}
                    <div className="flex flex-col items-end gap-2">
                      {trip.valor && (
                        <span className="text-lg font-black text-emerald-400">
                          R${" "}
                          {parseFloat(trip.valor).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}

                      {trip.status === "em_andamento" ? (
                        <Button
                          size="sm"
                          className="rounded-full px-4 font-bold text-xs shadow-lg"
                          style={{
                            background:
                              "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            setLocation(`/trips/${trip.id}/tracking`);
                          }}
                        >
                          <Navigation className="w-3 h-3 mr-1 fill-current" />
                          RASTREAR
                        </Button>
                      ) : trip.status === "planejada" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full px-4 font-bold text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={e => {
                            e.stopPropagation();
                            setLocation(`/trips/${trip.id}/tracking`);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1 fill-current" />
                          INICIAR
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full px-4 font-bold text-xs text-white/40 hover:text-white/60"
                          onClick={e => {
                            e.stopPropagation();
                            setLocation(`/trips/${trip.id}/tracking`);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          VER
                        </Button>
                      )}

                      <div onClick={e => e.stopPropagation()}>
                        <TripActions trip={trip} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="p-6 rounded-full bg-white/5 border border-white/10">
            <Route className="w-12 h-12 text-white/20" />
          </div>
          <p className="text-white/40 text-sm font-medium">
            Nenhuma viagem cadastrada
          </p>
          <p className="text-white/20 text-xs">
            Crie uma nova viagem para começar o rastreamento
          </p>
        </div>
      )}
    </div>
  );
}
