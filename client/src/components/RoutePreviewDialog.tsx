import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { wazeUrl, googleMapsDirUrl } from "@/lib/nav";

// Preview RÁPIDO da rota de uma viagem (origem→destino) num dialog — pra ver o
// trajeto "ali mesmo", sem sair da tela. Busca a viagem pelo id e traça a rota
// (OpenStreetMap), com botões de Waze/Google Maps pra navegação exata.
export function RoutePreviewDialog({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: trip } = trpc.trips.getById.useQuery(
    { id: tripId ?? 0 },
    { enabled: open && !!tripId }
  );
  const { data: route, isLoading } = trpc.geo.route.useQuery(
    { origem: trip?.origem ?? "", destino: trip?.destino ?? "" },
    { enabled: open && !!trip?.origem && !!trip?.destino }
  );

  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !route || !route.ok || !mapRef.current) return;
    const map = L.map(mapRef.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    const line = L.polyline(route.geometry, { color: "#6366f1", weight: 5 });
    L.circleMarker([route.origin.lat, route.origin.lng], {
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 1,
      radius: 8,
    })
      .bindPopup("Origem")
      .addTo(map);
    L.circleMarker([route.destination.lat, route.destination.lng], {
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 1,
      radius: 8,
    })
      .bindPopup("Destino")
      .addTo(map);
    line.addTo(map);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
    // O container só ganha tamanho depois que o dialog abre → recalcula.
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      map.remove();
    };
  }, [open, route]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {trip ? `Rota — ${trip.numeroViagem}` : "Rota da viagem"}
          </DialogTitle>
        </DialogHeader>
        {trip && (
          <div className="text-sm space-y-1">
            <p>
              <strong>Origem:</strong> {trip.origem}
            </p>
            <p>
              <strong>Destino:</strong> {trip.destino}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(wazeUrl(trip.destino), "_blank")}
              >
                <Navigation className="w-4 h-4 mr-1" /> Waze
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
                Google Maps
              </Button>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Traçando a rota…
          </div>
        ) : route?.ok ? (
          <>
            <div
              ref={mapRef}
              className="h-[360px] w-full rounded-lg bg-muted"
            />
            <p className="text-center text-[11px] text-muted-foreground">
              Traçado aproximado (OpenStreetMap). Para navegação exata use os
              botões acima.
            </p>
          </>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Não foi possível traçar a rota (verifique origem/destino).
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
