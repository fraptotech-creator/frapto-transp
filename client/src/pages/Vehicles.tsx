import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleDialog, VehicleActions } from "@/components/VehicleForms";
import { useLocation } from "wouter";
import { formatPlaca } from "@/lib/format";
import { Truck, Calendar, Gauge } from "lucide-react";

export default function Vehicles() {
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery();

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; gradient: string; glowClass: string }
    > = {
      ativo: {
        bg: "bg-emerald-500/20",
        text: "text-emerald-300",
        gradient: "from-emerald-500 to-teal-600",
        glowClass: "glow-effect-emerald",
      },
      manutencao: {
        bg: "bg-amber-500/20",
        text: "text-amber-300",
        gradient: "from-amber-500 to-orange-600",
        glowClass: "glow-effect",
      },
      inativo: {
        bg: "bg-rose-500/20",
        text: "text-rose-300",
        gradient: "from-rose-500 to-pink-600",
        glowClass: "glow-effect",
      },
    };
    return badges[status] || badges.ativo;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl glow-effect">
            <Truck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Veículos
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gerenciar frotas e veículos
            </p>
          </div>
        </div>
        <VehicleDialog />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : vehicles && vehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle: any) => {
            const statusInfo = getStatusBadge(vehicle.status);
            return (
              <Card
                key={vehicle.id}
                className={`relative overflow-hidden border-white/10 shadow-2xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] cursor-pointer group gradient-card ${statusInfo.glowClass}`}
                onClick={() => setLocation(`/vehicles/${vehicle.id}`)}
              >
                <div
                  className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${statusInfo.gradient} opacity-15 rounded-full -mr-20 -mt-20 group-hover:opacity-25 transition-opacity blur-3xl`}
                />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`p-3 rounded-xl ${statusInfo.bg} shadow-md backdrop-blur-xl border border-white/10`}
                    >
                      <Truck className={`w-6 h-6 ${statusInfo.text}`} />
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${statusInfo.bg} ${statusInfo.text} shadow-sm`}
                    >
                      {vehicle.status.charAt(0).toUpperCase() +
                        vehicle.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-white">
                        {formatPlaca(vehicle.placa)}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {vehicle.marca} {vehicle.modelo}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-400">
                          {vehicle.ano}
                        </span>
                      </div>
                      {vehicle.quilometragem && (
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-400">
                            {vehicle.quilometragem.toLocaleString()} km
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex justify-end mt-4 pt-4 border-t border-white/10"
                    onClick={e => e.stopPropagation()}
                  >
                    <VehicleActions vehicle={vehicle} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                <Truck className="w-12 h-12 text-gray-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  Nenhum veículo cadastrado
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Comece adicionando seu primeiro veículo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
