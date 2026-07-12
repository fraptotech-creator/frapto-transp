import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Truck, Navigation } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { wazeUrl, googleMapsDirUrl } from "@/lib/nav";

export default function TripTracking() {
  const [, params] = useRoute("/trips/:id/tracking");
  const [, setLocation] = useLocation();
  const tripId = params?.id ? parseInt(params.id, 10) : 0;

  const { data: trip, isLoading } = trpc.trips.getById.useQuery(
    { id: tripId },
    { enabled: tripId > 0 }
  );

  const { data: route, isLoading: routeLoading } = trpc.geo.route.useQuery(
    { origem: trip?.origem ?? "", destino: trip?.destino ?? "" },
    { enabled: !!trip?.origem && !!trip?.destino }
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const overlay = useRef<L.LayerGroup | null>(null);

  // Desmonta o mapa ao sair da tela.
  useEffect(() => {
    return () => {
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, []);

  // Desenha origem, destino e a rota quando os dados chegam.
  useEffect(() => {
    if (!route || !route.ok || !mapRef.current) return;
    if (!mapObj.current) {
      mapObj.current = L.map(mapRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapObj.current);
    }
    const map = mapObj.current;
    if (!overlay.current) overlay.current = L.layerGroup().addTo(map);
    overlay.current.clearLayers();

    const line = L.polyline(route.geometry, { color: "#6366f1", weight: 5 });
    const origem = L.circleMarker([route.origin.lat, route.origin.lng], {
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 1,
      radius: 8,
    }).bindPopup("Origem");
    const destino = L.circleMarker(
      [route.destination.lat, route.destination.lng],
      { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, radius: 8 }
    ).bindPopup("Destino");

    overlay.current.addLayer(line);
    overlay.current.addLayer(origem);
    overlay.current.addLayer(destino);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }, [route]);

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
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                <strong>Origem:</strong> {trip.origem}
              </p>
              <p>
                <strong>Destino:</strong> {trip.destino}
              </p>
              <p>
                <strong>Status:</strong> {trip.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(wazeUrl(trip.destino), "_blank")}
              >
                <Navigation className="w-4 h-4 mr-1" /> Navegar no Waze
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    googleMapsDirUrl(trip.origem, trip.destino),
                    "_blank"
                  )
                }
              >
                Abrir no Google Maps
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Rota
            {route?.ok && (
              <span className="text-xs font-normal text-muted-foreground">
                · {route.distanceKm} km · ~{route.durationMin} min
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {routeLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Traçando a rota…
            </div>
          ) : route?.ok ? (
            <>
              <div ref={mapRef} className="h-[420px] w-full bg-muted" />
              <p className="p-2 text-center text-[11px] text-muted-foreground">
                Traçado aproximado (mapa gratuito OpenStreetMap). Para navegação
                exata, use os botões acima (Waze / Google Maps).
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <MapPin className="w-10 h-10 opacity-30" />
              <p className="font-medium">Não foi possível traçar a rota</p>
              <p className="text-xs max-w-sm">
                Verifique se a origem e o destino são endereços válidos (ex.:
                "Viana, ES"). Você ainda pode usar o botão do Waze acima.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
