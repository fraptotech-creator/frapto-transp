/// <reference types="google.maps" />
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

export default function TripTracking() {
  const [, params] = useRoute("/trips/:id/tracking");
  const [, setLocation] = useLocation();
  const tripId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: config } = trpc.config.get.useQuery();
  const { data: trip, isLoading } = trpc.trips.getById.useQuery(
    { id: tripId },
    { enabled: tripId > 0 }
  );

  const { loaded, error: mapsError } = useGoogleMaps(
    config?.googleMapsApiKey || undefined
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const [routeError, setRouteError] = useState(false);

  useEffect(() => {
    if (!loaded || !trip || !mapRef.current) return;
    setRouteError(false);
    const map = new google.maps.Map(mapRef.current, {
      zoom: 5,
      center: { lat: -15.78, lng: -47.93 }, // Brasil
      disableDefaultUI: false,
      streetViewControl: false,
      mapTypeControl: false,
    });
    const renderer = new google.maps.DirectionsRenderer({ map });
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: trip.origem,
        destination: trip.destino,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          renderer.setDirections(result);
        } else {
          setRouteError(true);
        }
      }
    );
  }, [loaded, trip]);

  const mapsConfigured = config?.mapsConfigured ?? false;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
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

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Rota
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!mapsConfigured ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <MapPin className="w-10 h-10 opacity-30" />
              <p className="font-medium">Mapa não configurado</p>
              <p className="text-xs max-w-sm">
                O administrador precisa definir a chave do Google Maps.
              </p>
            </div>
          ) : mapsError ? (
            <div className="py-16 text-center text-sm text-rose-500">
              Falha ao carregar o Google Maps.
            </div>
          ) : (
            <>
              <div ref={mapRef} className="h-[420px] w-full bg-muted" />
              {routeError && (
                <p className="p-3 text-center text-xs text-amber-600">
                  Não foi possível traçar a rota para estes endereços. Verifique
                  origem e destino.
                </p>
              )}
              {!loaded && (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  Carregando mapa…
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
