import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverDialog, DriverActions } from "@/components/DriverForms";
import { useLocation } from "wouter";
import { Users, Phone, CreditCard, User } from "lucide-react";

export default function Drivers() {
  const [, setLocation] = useLocation();
  const { data: drivers, isLoading } = trpc.drivers.list.useQuery();

  const getStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; gradient: string; glowClass: string }
    > = {
      disponivel: {
        bg: "bg-emerald-500/20",
        text: "text-emerald-300",
        gradient: "from-emerald-500 to-teal-600",
        glowClass: "glow-effect-emerald",
      },
      viagem: {
        bg: "bg-blue-500/20",
        text: "text-blue-300",
        gradient: "from-blue-500 to-indigo-600",
        glowClass: "glow-effect",
      },
      descansando: {
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
    return badges[status] || badges.disponivel;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-2xl glow-effect-emerald">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Motoristas
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gerenciar equipe de motoristas
            </p>
          </div>
        </div>
        <DriverDialog />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : drivers && drivers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver: any) => {
            const statusInfo = getStatusBadge(driver.status);
            return (
              <Card
                key={driver.id}
                className={`relative overflow-hidden border-white/10 shadow-2xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] cursor-pointer group gradient-card ${statusInfo.glowClass}`}
                onClick={() => setLocation(`/drivers/${driver.id}`)}
              >
                <div
                  className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${statusInfo.gradient} opacity-15 rounded-full -mr-20 -mt-20 group-hover:opacity-25 transition-opacity blur-3xl`}
                />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`p-3 rounded-xl ${statusInfo.bg} shadow-md backdrop-blur-xl border border-white/10`}
                    >
                      <User className={`w-6 h-6 ${statusInfo.text}`} />
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${statusInfo.bg} ${statusInfo.text} shadow-sm`}
                    >
                      {driver.status.charAt(0).toUpperCase() +
                        driver.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold tracking-tight truncate text-white">
                        {driver.nome}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
                        <CreditCard className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="text-xs text-gray-400 truncate">
                          {driver.cpf}
                        </span>
                      </div>

                      {driver.telefone && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
                          <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                          <span className="text-xs text-gray-400 truncate">
                            {driver.telefone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex justify-end mt-4 pt-4 border-t border-white/10"
                    onClick={e => e.stopPropagation()}
                  >
                    <DriverActions driver={driver} />
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
                <Users className="w-12 h-12 text-gray-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  Nenhum motorista cadastrado
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Comece adicionando seu primeiro motorista
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
