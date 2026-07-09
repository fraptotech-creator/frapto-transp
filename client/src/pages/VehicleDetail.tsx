import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatPlaca } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Truck } from "lucide-react";
import { VehicleDialog } from "@/components/VehicleForms";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function VehicleDetail() {
  const [, params] = useRoute("/vehicles/:id");
  const vehicleId = params?.id ? parseInt(params.id) : null;

  const { data: vehicle, isLoading } = trpc.vehicles.getById.useQuery(
    { id: vehicleId! },
    { enabled: !!vehicleId }
  );

  const { data: trips } = trpc.trips.list.useQuery();
  const { data: maintenances } = trpc.maintenance.getByVehicle.useQuery(
    { veiculoId: vehicleId! },
    { enabled: !!vehicleId }
  );

  const vehicleTrips =
    trips?.filter((t: any) => t.veiculoId === vehicleId) || [];
  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      ativo:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      manutencao:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      inativo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return badges[status] || badges.ativo;
  };

  const getMaintenanceStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pendente:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      em_andamento:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      concluida:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };
    return badges[status] || badges.pendente;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Veículo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{formatPlaca(vehicle.placa)}</h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.marca} {vehicle.modelo} ({vehicle.ano})
            </p>
          </div>
        </div>
        <VehicleDialog vehicle={vehicle} />
      </div>

      {/* Main Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Informações Gerais</CardTitle>
            <Badge className={getStatusBadge(vehicle.status)}>
              {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipo</p>
              <p className="font-medium capitalize">{vehicle.tipo}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Quilometragem
              </p>
              <p className="font-medium">
                {vehicle.quilometragem?.toLocaleString("pt-BR")} km
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Capacidade de Carga
              </p>
              <p className="font-medium">
                {vehicle.capacidadeCarga
                  ? parseFloat(
                      vehicle.capacidadeCarga.toString()
                    ).toLocaleString("pt-BR")
                  : "N/A"}{" "}
                kg
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rastreador</p>
              <p className="font-medium">
                {vehicle.rastreadorId || "Não informado"}
              </p>
            </div>
          </div>
          {vehicle.observacoes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{vehicle.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Documentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">CRLV</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.crlvVencimento
                    ? format(
                        new Date(vehicle.crlvVencimento),
                        "dd 'de' MMMM 'de' yyyy",
                        { locale: ptBR }
                      )
                    : "Não informado"}
                </p>
              </div>
              {vehicle.crlvVencimento &&
                new Date(vehicle.crlvVencimento) < new Date() && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Vencido
                  </Badge>
                )}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Seguro</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.seguroVencimento
                    ? format(
                        new Date(vehicle.seguroVencimento),
                        "dd 'de' MMMM 'de' yyyy",
                        { locale: ptBR }
                      )
                    : "Não informado"}
                </p>
              </div>
              {vehicle.seguroVencimento &&
                new Date(vehicle.seguroVencimento) < new Date() && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Vencido
                  </Badge>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de Manutenção</CardTitle>
          <CardDescription className="text-xs">
            {maintenances?.length || 0} registros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {maintenances && maintenances.length > 0 ? (
            maintenances.map((maintenance: any) => (
              <div
                key={maintenance.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-medium">{maintenance.tipo}</p>
                    <p className="text-xs text-muted-foreground">
                      {maintenance.descricao}
                    </p>
                  </div>
                  <Badge
                    className={getMaintenanceStatusBadge(maintenance.status)}
                  >
                    {maintenance.status.charAt(0).toUpperCase() +
                      maintenance.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Prevista:{" "}
                    {maintenance.dataPrevista
                      ? format(
                          new Date(maintenance.dataPrevista),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )
                      : "N/A"}
                  </span>
                  {maintenance.custo && (
                    <span>
                      R${" "}
                      {parseFloat(maintenance.custo.toString()).toLocaleString(
                        "pt-BR"
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma manutenção registrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Trip History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de Viagens</CardTitle>
          <CardDescription className="text-xs">
            {vehicleTrips.length} viagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {vehicleTrips.length > 0 ? (
            vehicleTrips.slice(0, 10).map((trip: any) => (
              <div
                key={trip.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {trip.origem} → {trip.destino}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trip.dataPartida
                        ? format(
                            new Date(trip.dataPartida),
                            "dd/MM/yyyy HH:mm",
                            { locale: ptBR }
                          )
                        : "N/A"}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                  </Badge>
                </div>
                {trip.distancia && (
                  <p className="text-xs text-muted-foreground">
                    Distância: {trip.distancia} km
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma viagem registrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
