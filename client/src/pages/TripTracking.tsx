import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, MapPin, Truck } from "lucide-react";
import { useRoute, useLocation } from "wouter";

/**
 * Rastreamento ao vivo com mapa — ADIADO nesta versão.
 * O mapa dependia do proxy de mapas do Manus (removido na migração p/ Railway).
 * Será religado com uma chave própria (Google Maps) em uma etapa dedicada.
 * Enquanto isso, esta página mostra os dados da viagem sem o mapa.
 */
export default function TripTracking() {
  const [, params] = useRoute("/trips/:id/tracking");
  const [, setLocation] = useLocation();
  const tripId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: trip, isLoading } = trpc.trips.getById.useQuery(
    { id: tripId },
    { enabled: tripId > 0 }
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => setLocation("/trips")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Viagens
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {isLoading
              ? "Carregando viagem..."
              : trip
                ? `Viagem ${trip.numeroViagem}`
                : "Viagem não encontrada"}
          </CardTitle>
        </CardHeader>
        {trip && (
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Origem:</strong> {trip.origem}
            </p>
            <p>
              <strong>Destino:</strong> {trip.destino}
            </p>
            <p>
              <strong>Status:</strong> {trip.status}
            </p>
          </CardContent>
        )}
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
          <MapPin className="w-10 h-10 opacity-30" />
          <p className="font-medium">Rastreamento com mapa em breve</p>
          <p className="text-xs max-w-sm">
            O mapa ao vivo será habilitado em uma próxima etapa, com integração
            de mapas própria.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
