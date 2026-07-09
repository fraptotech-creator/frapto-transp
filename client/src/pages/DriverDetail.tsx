import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCpf, formatPhone } from "@/lib/format";
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
import { ArrowLeft, Calendar, Phone, Mail, AlertCircle } from "lucide-react";
import { DriverDialog } from "@/components/DriverForms";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DriverDetail() {
  const [, params] = useRoute("/drivers/:id");
  const driverId = params?.id ? parseInt(params.id) : null;

  const { data: driver, isLoading } = trpc.drivers.getById.useQuery(
    { id: driverId! },
    { enabled: !!driverId }
  );

  const { data: trips } = trpc.trips.list.useQuery();
  const driverTrips =
    trips?.filter((t: any) => t.motoristaId === driverId) || [];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      disponivel:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      viagem:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      descansando:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      inativo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return badges[status] || badges.disponivel;
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

  if (!driver) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Motorista não encontrado</p>
      </div>
    );
  }

  const cnhExpired = driver.cnhVencimento
    ? new Date(driver.cnhVencimento) < new Date()
    : false;

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
            <h1 className="text-2xl font-bold">{driver.nome}</h1>
            <p className="text-sm text-muted-foreground">
              CPF: {formatCpf(driver.cpf)}
            </p>
          </div>
        </div>
        <DriverDialog driver={driver} />
      </div>

      {/* Main Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Informações Gerais</CardTitle>
            <Badge className={getStatusBadge(driver.status)}>
              {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {driver.telefone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a
                  href={`tel:${driver.telefone}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {formatPhone(driver.telefone)}
                </a>
              </div>
            )}
            {driver.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a
                  href={`mailto:${driver.email}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {driver.email}
                </a>
              </div>
            )}
            {driver.endereco && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                <p className="text-sm">{driver.endereco}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Data de Admissão
              </p>
              <p className="text-sm">
                {driver.dataAdmissao
                  ? format(
                      new Date(driver.dataAdmissao),
                      "dd 'de' MMMM 'de' yyyy",
                      { locale: ptBR }
                    )
                  : "N/A"}
              </p>
            </div>
          </div>
          {driver.observacoes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{driver.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CNH Information */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Carteira Nacional de Habilitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-medium">CNH: {driver.cnh}</p>
                <p className="text-xs text-muted-foreground">
                  Categoria: {driver.cnhCategoria}
                </p>
              </div>
              {cnhExpired && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Vencida
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vencimento:{" "}
              {driver.cnhVencimento
                ? format(
                    new Date(driver.cnhVencimento),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )
                : "N/A"}
            </p>
          </div>
          {cnhExpired && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  CNH Vencida
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  A CNH deste motorista está vencida. Renove para continuar
                  operações.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de Viagens</CardTitle>
          <CardDescription className="text-xs">
            {driverTrips.length} viagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {driverTrips.length > 0 ? (
            driverTrips.slice(0, 10).map((trip: any) => (
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
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {trip.distancia && (
                    <span>Distância: {trip.distancia} km</span>
                  )}
                  {trip.valor && (
                    <span>
                      Valor: R${" "}
                      {parseFloat(trip.valor.toString()).toLocaleString(
                        "pt-BR"
                      )}
                    </span>
                  )}
                </div>
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
