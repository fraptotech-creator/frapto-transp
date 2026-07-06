import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Truck, Users, MapPin, AlertCircle, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: trips } = trpc.trips.list.useQuery();
  const { data: drivers } = trpc.drivers.list.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  // Métricas reais (sem números fictícios)
  const tripsAtivas =
    trips?.filter(
      (t: any) => t.status === "em_andamento" || t.status === "planejada"
    ).length || 0;

  const motoristasDisponiveis =
    drivers?.filter((d: any) => d.status === "disponivel").length || 0;

  const statCards = [
    {
      title: "Frota Total",
      value: stats?.totalVehicles ?? 0,
      subtitle: `${stats?.fleetStatus?.ativo ?? 0} ativo${(stats?.fleetStatus?.ativo ?? 0) === 1 ? "" : "s"}`,
      icon: Truck,
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
      glowClass: "glow-effect",
    },
    {
      title: "Motoristas",
      value: stats?.totalDrivers ?? 0,
      subtitle: `${motoristasDisponiveis} disponíve${
        motoristasDisponiveis === 1 ? "l" : "is"
      }`,
      icon: Users,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
      glowClass: "glow-effect-emerald",
    },
    {
      title: "Viagens",
      value: stats?.totalTrips ?? 0,
      subtitle: `${tripsAtivas} em andamento ou planejada${
        tripsAtivas === 1 ? "" : "s"
      }`,
      icon: MapPin,
      gradient: "from-purple-500 to-violet-600",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-400",
      glowClass: "glow-effect-purple",
    },
    {
      title: "Alertas",
      value: stats?.alerts?.length ?? 0,
      subtitle:
        (stats?.alerts?.length ?? 0) === 0
          ? "Tudo em dia"
          : "Verifique os alertas abaixo",
      icon: AlertCircle,
      gradient: "from-rose-500 to-pink-600",
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-400",
      glowClass: "glow-effect",
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl glow-effect">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Painel de Controle
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Bem-vindo ao sistema de gestão de frotas Frapto Transp
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={`relative overflow-hidden border-white/10 shadow-2xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] group stat-card ${stat.glowClass}`}
            >
              <div
                className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full -mr-20 -mt-20 group-hover:opacity-20 transition-opacity blur-3xl`}
              />
              <CardContent className="p-6 relative z-10">
                <div className="flex items-start justify-between">
                  <div
                    className={`p-4 rounded-2xl ${stat.iconBg} shadow-xl backdrop-blur-xl border border-white/10`}
                  >
                    <Icon className={`w-7 h-7 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {stat.title}
                  </p>
                  <p className="text-4xl font-bold tracking-tight mt-2 text-white">
                    {stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xs text-gray-400 mt-2">
                      {stat.subtitle}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-400 to-purple-600 rounded-full" />
              Viagens nos Últimos 6 Meses
            </CardTitle>
            <CardDescription className="text-sm text-gray-400">
              Total de viagens cadastradas por mês
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.tripsByMonth || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.15}
                  stroke="rgba(255,255,255,0.1)"
                />
                <XAxis
                  dataKey="month"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "rgba(255,255,255,0.6)" }}
                />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "rgba(255,255,255,0.6)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    backgroundColor: "rgba(20, 30, 60, 0.8)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#colorGradient)"
                  radius={[8, 8, 0, 0]}
                />
                <defs>
                  <linearGradient
                    id="colorGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-white/10 shadow-2xl gradient-card-strong">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full" />
              Status da Frota
            </CardTitle>
            <CardDescription className="text-sm text-gray-400">
              Distribuição por categoria
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {(stats?.totalVehicles ?? 0) === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">
                  Nenhum veículo cadastrado ainda.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full gap-8">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Ativo",
                          value: stats?.fleetStatus?.ativo || 0,
                          color: "#10b981",
                        },
                        {
                          name: "Manutenção",
                          value: stats?.fleetStatus?.manutencao || 0,
                          color: "#f59e0b",
                        },
                        {
                          name: "Inativo",
                          value: stats?.fleetStatus?.inativo || 0,
                          color: "#ef4444",
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {[0, 1, 2].map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={["#10b981", "#f59e0b", "#ef4444"][index]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.2)",
                        backgroundColor: "rgba(20, 30, 60, 0.8)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      name: "Ativo",
                      value: stats?.fleetStatus?.ativo || 0,
                      color: "#10b981",
                    },
                    {
                      name: "Manutenção",
                      value: stats?.fleetStatus?.manutencao || 0,
                      color: "#f59e0b",
                    },
                    {
                      name: "Inativo",
                      value: stats?.fleetStatus?.inativo || 0,
                      color: "#ef4444",
                    },
                  ].map((entry: any) => (
                    <div key={entry.name} className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-lg shadow-md"
                        style={{ backgroundColor: entry.color }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {entry.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {entry.value} unidade{entry.value === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Important Alerts */}
      <Card className="border-white/10 shadow-2xl gradient-card-strong">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <div className="w-1 h-6 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full" />
            Alertas Importantes
          </CardTitle>
          <CardDescription className="text-sm text-gray-400">
            Documentos e manutenções vencendo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats?.alerts && stats.alerts.length > 0 ? (
            stats.alerts.map((alert: any, index: number) => {
              const isCritical =
                alert.urgency === "alta" || alert.type === "cnh";
              const bgColor = isCritical
                ? "bg-gradient-to-r from-red-900/30 to-rose-900/20"
                : "bg-gradient-to-r from-yellow-900/30 to-amber-900/20";
              const borderColor = isCritical
                ? "border-red-500/30"
                : "border-yellow-500/30";
              const textColor = isCritical ? "text-red-300" : "text-yellow-300";
              const messageColor = isCritical
                ? "text-red-200"
                : "text-yellow-200";

              return (
                <div
                  key={index}
                  className={`p-4 rounded-2xl ${bgColor} border ${borderColor} shadow-sm hover:shadow-md transition-all backdrop-blur-xl`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`w-5 h-5 ${textColor} mt-0.5 shrink-0`}
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${textColor}`}>
                        {alert.title}
                      </p>
                      <p className={`text-xs ${messageColor} mt-1`}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-500/30 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-green-300">
                    ✓ Tudo em dia
                  </p>
                  <p className="text-xs text-green-200 mt-1">
                    Nenhum alerta no momento
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
