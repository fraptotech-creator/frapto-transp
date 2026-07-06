import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  MapPin, Navigation, Clock, Truck, User, Package, DollarSign,
  ArrowLeft, Share2, ChevronUp, ChevronDown,
  Route, Gauge, Timer, CheckCircle2, Play, Square,
  Home, Warehouse, ArrowRight, Loader2, Wifi, WifiOff
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { state, notify } from "@/lib/mockState";

// ─── Constantes ──────────────────────────────────────────────────────────────
const getGaragem = () => (state as any).empresa?.garagem || "Av. Paulista, 1000, São Paulo, SP";

// Distância em metros para considerar que chegou ao destino
const ARRIVAL_THRESHOLD_METERS = 150;

// Intervalo de recálculo de rota (ms) quando GPS está ativo
const REROUTE_INTERVAL_MS = 30000;

// Desvio máximo da rota (metros) antes de recalcular
const REROUTE_DEVIATION_METERS = 300;

type TripStage =
  | "aguardando"
  | "indo_coleta"
  | "indo_entrega"
  | "retornando_base"
  | "retornando_garagem"
  | "concluida";

interface StageConfig {
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  fromLabel: string;
  toLabel: string;
}

const STAGE_CONFIGS: Record<TripStage, StageConfig> = {
  aguardando: {
    label: "Aguardando Início",
    sublabel: "Pronto para iniciar",
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-400/30",
    icon: <Clock className="w-4 h-4" />,
    fromLabel: "",
    toLabel: "",
  },
  indo_coleta: {
    label: "A Caminho da Coleta",
    sublabel: "Etapa 1 de 4",
    color: "text-amber-300",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-400/30",
    icon: <Navigation className="w-4 h-4 animate-pulse" />,
    fromLabel: "Localização Atual",
    toLabel: "Ponto de Coleta",
  },
  indo_entrega: {
    label: "Em Rota de Entrega",
    sublabel: "Etapa 2 de 4",
    color: "text-indigo-300",
    bgColor: "bg-indigo-500/20",
    borderColor: "border-indigo-400/30",
    icon: <Truck className="w-4 h-4 animate-pulse" />,
    fromLabel: "Ponto de Coleta",
    toLabel: "Destino Final",
  },
  retornando_base: {
    label: "Retornando à Base",
    sublabel: "Etapa 3 de 4",
    color: "text-purple-300",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-400/30",
    icon: <Route className="w-4 h-4 animate-pulse" />,
    fromLabel: "Destino Final",
    toLabel: "Base / Coleta",
  },
  retornando_garagem: {
    label: "Retornando à Garagem",
    sublabel: "Etapa 4 de 4",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-400/30",
    icon: <Home className="w-4 h-4 animate-pulse" />,
    fromLabel: "Base / Coleta",
    toLabel: "Garagem",
  },
  concluida: {
    label: "Viagem Concluída",
    sublabel: "Todas as etapas finalizadas",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-400/30",
    icon: <CheckCircle2 className="w-4 h-4" />,
    fromLabel: "",
    toLabel: "",
  },
};

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Distância em metros entre dois pontos GPS (fórmula de Haversine) */
function haversineDistance(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral
): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Calcula bearing (direção) entre dois pontos */
function computeBearing(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral
): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h${m > 0 ? m + "m" : ""}`;
}

/** Encontra o ponto mais próximo na polyline à posição atual */
function findClosestPointOnPath(
  pos: google.maps.LatLngLiteral,
  path: google.maps.LatLng[]
): { index: number; distanceMeters: number } {
  let minDist = Infinity;
  let minIdx = 0;
  path.forEach((p, i) => {
    const d = haversineDistance(pos, { lat: p.lat(), lng: p.lng() });
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  });
  return { index: minIdx, distanceMeters: minDist };
}

/** Calcula distância percorrida na rota até o índice atual */
function distanceAlongPath(
  path: google.maps.LatLng[],
  upToIndex: number
): number {
  let total = 0;
  for (let i = 1; i <= Math.min(upToIndex, path.length - 1); i++) {
    total += haversineDistance(
      { lat: path[i - 1].lat(), lng: path[i - 1].lng() },
      { lat: path[i].lat(), lng: path[i].lng() }
    );
  }
  return total;
}

/** Calcula distância total da rota */
function totalPathDistance(path: google.maps.LatLng[]): number {
  return distanceAlongPath(path, path.length - 1);
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function TripTracking() {
  const [, params] = useRoute("/trips/:id/tracking");
  const [, setLocation] = useLocation();
  const tripId = params?.id ? parseInt(params.id) : undefined;

  const { data: trip } = trpc.trips.getById.useQuery(
    { id: tripId! },
    { enabled: !!tripId }
  );
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const { data: drivers } = trpc.drivers.list.useQuery();

  const vehicle = vehicles?.find((v: any) => v.id === trip?.veiculoId);
  const driver = drivers?.find((d: any) => d.id === (trip as any)?.motoristaId);

  // ── Estados
  const [stage, setStage] = useState<TripStage>("aguardando");
  const [isTracking, setIsTracking] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);        // GPS real ativo
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceCovered, setDistanceCovered] = useState(0); // km percorridos na etapa
  const [distanceTotal, setDistanceTotal] = useState(0);     // km total da etapa
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [stageDestination, setStageDestination] = useState<string | google.maps.LatLngLiteral | null>(null);

  // ── Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<google.maps.LatLng[]>([]);
  const watchIdRef = useRef<number | null>(null);           // ID do watchPosition
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<TripStage>("aguardando");
  const lastPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastRerouteRef = useRef<number>(0);
  const stageTotalDistRef = useRef<number>(0);              // distância total da etapa em metros
  const stageCoveredDistRef = useRef<number>(0);            // distância percorrida na etapa em metros
  const lastSpeedUpdateRef = useRef<{ pos: google.maps.LatLngLiteral; time: number } | null>(null);

  // Manter ref de stage sincronizado
  useEffect(() => { stageRef.current = stage; }, [stage]);

  // Sincronizar status da viagem com o stage
  useEffect(() => {
    if (trip?.status === "em_andamento" && stage === "aguardando") {
      // Viagem já estava em andamento — retomar rastreamento
      setStage("indo_coleta");
      setIsTracking(true);
    } else if (trip?.status === "concluida") {
      setStage("concluida");
      setTotalProgress(100);
    }
  }, [trip?.status]);

  // Timer de tempo decorrido
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking]);

  // ── Criar ícone do veículo
  const createVehicleIcon = useCallback((stg: TripStage = "indo_entrega") => {
    const colors: Record<string, string> = {
      indo_coleta: "#f59e0b",
      indo_entrega: "#6366f1",
      retornando_base: "#a855f7",
      retornando_garagem: "#22c55e",
      concluida: "#22c55e",
      aguardando: "#3b82f6",
    };
    const color = colors[stg] || "#6366f1";
    const el = document.createElement("div");
    el.className = "vehicle-marker";
    el.innerHTML = `
      <div style="position:relative;width:52px;height:52px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${color}33;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
        "></div>
        <div style="
          position:absolute;inset:4px;border-radius:50%;
          background:${color}22;border:2px solid ${color}66;
        "></div>
        <div style="
          position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          background:${color};border-radius:50%;border:3px solid white;
          box-shadow:0 4px 20px ${color}88;
          width:42px;height:42px;margin:5px;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div class="direction-arrow" style="
          position:absolute;top:-10px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;border-right:6px solid transparent;
          border-bottom:10px solid ${color};
          filter:drop-shadow(0 2px 4px ${color}88);
        "></div>
      </div>`;
    return el;
  }, []);

  // ── Traçar rota para etapa
  const traceRoute = useCallback((
    from: string | google.maps.LatLngLiteral,
    to: string | google.maps.LatLngLiteral,
    stg: TripStage,
    onComplete?: (path: google.maps.LatLng[], leg: any) => void
  ) => {
    if (!mapRef.current || !window.google?.maps) return;

    const colors: Record<string, string> = {
      indo_coleta: "#f59e0b",
      indo_entrega: "#6366f1",
      retornando_base: "#a855f7",
      retornando_garagem: "#22c55e",
    };

    if (rendererRef.current) rendererRef.current.setMap(null);

    const renderer = new google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: colors[stg] || "#6366f1",
        strokeWeight: 6,
        strokeOpacity: 0.9,
        geodesic: true,
      },
    });
    rendererRef.current = renderer;

    const svc = new google.maps.DirectionsService();
    svc.route(
      { origin: from, destination: to, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          renderer.setDirections(result);
          const leg = result.routes[0].legs[0];
          pathRef.current = result.routes[0].overview_path;

          // Calcular distância total da etapa
          const totalDist = totalPathDistance(pathRef.current);
          stageTotalDistRef.current = totalDist;
          stageCoveredDistRef.current = 0;

          setDistanceTotal(Math.round(totalDist / 1000));
          setDistanceCovered(0);
          if (leg?.duration?.value) setEtaMinutes(Math.ceil(leg.duration.value / 60));

          // Posicionar marcador no ponto de partida
          if (markerRef.current) {
            markerRef.current.position = typeof from === "string"
              ? leg.start_location
              : from;
            const newIcon = createVehicleIcon(stg);
            markerRef.current.content = newIcon;
            markerElRef.current = newIcon as any;
          }

          // Fit bounds
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
          mapRef.current?.fitBounds(bounds, { top: 80, bottom: 240, left: 40, right: 40 });

          onComplete?.(result.routes[0].overview_path, leg);
        } else {
          toast.error(`Não foi possível traçar a rota: ${STAGE_CONFIGS[stg].label}`);
        }
      }
    );
  }, [createVehicleIcon]);

  // ── Atualizar posição do veículo no mapa com base no GPS real
  const updateVehiclePosition = useCallback((pos: google.maps.LatLngLiteral, accuracy: number, speed: number | null) => {
    if (!mapRef.current || !markerRef.current) return;

    // Mover marcador para posição real
    markerRef.current.position = pos;

    // Rotacionar seta de direção
    if (lastPosRef.current && markerElRef.current) {
      const bearing = computeBearing(lastPosRef.current, pos);
      const arrow = markerElRef.current.querySelector(".direction-arrow") as HTMLElement;
      if (arrow) arrow.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
    }

    // Centralizar mapa suavemente no veículo
    mapRef.current.panTo(pos);

    // Calcular velocidade (se GPS não fornecer)
    let kmh = 0;
    if (speed !== null && speed >= 0) {
      kmh = Math.round(speed * 3.6); // m/s → km/h
    } else if (lastSpeedUpdateRef.current) {
      const dt = (Date.now() - lastSpeedUpdateRef.current.time) / 1000; // segundos
      if (dt > 0) {
        const dm = haversineDistance(lastSpeedUpdateRef.current.pos, pos);
        kmh = Math.round((dm / dt) * 3.6);
      }
    }
    setCurrentSpeed(Math.min(kmh, 200)); // limitar a 200 km/h para evitar spikes
    lastSpeedUpdateRef.current = { pos, time: Date.now() };

    // Calcular progresso na rota
    if (pathRef.current.length > 0) {
      const { index, distanceMeters } = findClosestPointOnPath(pos, pathRef.current);
      const covered = distanceAlongPath(pathRef.current, index);
      stageCoveredDistRef.current = covered;
      const coveredKm = Math.round(covered / 1000);
      setDistanceCovered(coveredKm);

      const totalDist = stageTotalDistRef.current || totalPathDistance(pathRef.current);
      const progress = Math.min((covered / totalDist) * 100, 100);

      // Progresso total (cada etapa = 25%)
      const stageIndex = ["indo_coleta", "indo_entrega", "retornando_base", "retornando_garagem"].indexOf(stageRef.current);
      if (stageIndex >= 0) {
        setTotalProgress(stageIndex * 25 + progress * 0.25);
      }

      // ETA baseado na distância restante e velocidade atual
      const remainingMeters = totalDist - covered;
      if (kmh > 5) {
        const etaSec = (remainingMeters / (kmh / 3.6));
        setEtaMinutes(Math.ceil(etaSec / 60));
      }

      // Verificar se chegou ao destino
      if (stageDestination && distanceMeters < ARRIVAL_THRESHOLD_METERS) {
        handleArrival();
        return;
      }

      // Recalcular rota se desviou muito
      const now = Date.now();
      if (
        distanceMeters > REROUTE_DEVIATION_METERS &&
        now - lastRerouteRef.current > REROUTE_INTERVAL_MS &&
        stageDestination
      ) {
        lastRerouteRef.current = now;
        toast.info("🔄 Recalculando rota...", { duration: 2000 });
        traceRoute(pos, stageDestination, stageRef.current);
      }
    }

    lastPosRef.current = pos;
  }, [stageDestination, traceRoute]);

  // ── Lidar com chegada ao destino da etapa
  const handleArrival = useCallback(() => {
    const currentStage = stageRef.current;
    const tripData = state.trips.find((t: any) => t.id === tripId);
    if (!tripData) return;

    if (currentStage === "indo_coleta") {
      toast.success("✅ Chegou ao ponto de coleta! Iniciando entrega...", { duration: 4000 });
      const dest = tripData.destino;
      setStageDestination(dest);
      setStage("indo_entrega");
      stageRef.current = "indo_entrega";
      traceRoute(tripData.origem, dest, "indo_entrega");

    } else if (currentStage === "indo_entrega") {
      toast.success("📦 Carga entregue! Retornando à base...", { duration: 4000 });
      const dest = tripData.origem;
      setStageDestination(dest);
      setStage("retornando_base");
      stageRef.current = "retornando_base";
      traceRoute(tripData.destino, dest, "retornando_base");

    } else if (currentStage === "retornando_base") {
      toast.success("🏁 Retornou à base! Indo para a garagem...", { duration: 4000 });
      const garagem = getGaragem();
      setStageDestination(garagem);
      setStage("retornando_garagem");
      stageRef.current = "retornando_garagem";
      traceRoute(tripData.origem, garagem, "retornando_garagem");

    } else if (currentStage === "retornando_garagem") {
      // Viagem concluída
      stopGPS();
      setStage("concluida");
      stageRef.current = "concluida";
      setIsTracking(false);
      setTotalProgress(100);
      setCurrentSpeed(0);

      const tripIndex = state.trips.findIndex((t: any) => t.id === tripId);
      if (tripIndex !== -1) {
        state.trips[tripIndex] = { ...state.trips[tripIndex], status: "concluida" };
        notify();
      }
      toast.success("🎉 Viagem concluída! Veículo na garagem.", { duration: 5000 });
    }
  }, [tripId, traceRoute]);

  // ── Fallback: simular movimento suave pela rota quando GPS não disponível
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simProgressRef = useRef(0); // 0-1 ao longo da rota

  const startSimulatedTracking = useCallback(() => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    simProgressRef.current = 0;

    simulationRef.current = setInterval(() => {
      const path = pathRef.current;
      if (!path.length) return;

      simProgressRef.current = Math.min(simProgressRef.current + 0.003, 1);
      const pos = simProgressRef.current;
      const totalSteps = path.length;
      const idx = Math.floor(pos * (totalSteps - 1));
      const nextIdx = Math.min(idx + 1, totalSteps - 1);
      const fraction = pos * (totalSteps - 1) - idx;

      const lat = path[idx].lat() + (path[nextIdx].lat() - path[idx].lat()) * fraction;
      const lng = path[idx].lng() + (path[nextIdx].lng() - path[idx].lng()) * fraction;
      const simPos = { lat, lng };

      setCurrentPos(simPos);
      updateVehiclePosition(simPos, 50, 60 + Math.random() * 30);

      if (simProgressRef.current >= 1) {
        clearInterval(simulationRef.current!);
        simulationRef.current = null;
        handleArrival();
      }
    }, 1000);
  }, [updateVehiclePosition, handleArrival]);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  // ── Parar GPS
  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopSimulation();
    setGpsActive(false);
  }, [stopSimulation]);

  // ── Iniciar watchPosition (GPS real)
  const startGPSTracking = useCallback((initialPos: google.maps.LatLngLiteral) => {
    if (!navigator.geolocation) return;

    setGpsActive(true);
    lastPosRef.current = initialPos;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos: google.maps.LatLngLiteral = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setCurrentPos(pos);
        updateVehiclePosition(pos, position.coords.accuracy, position.coords.speed);
      },
      (error) => {
        console.warn("GPS error:", error);
        setGpsActive(false);
        toast.warning("⚠️ GPS perdido. Última posição mantida.", { duration: 3000 });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  }, [updateVehiclePosition]);

  // ── Iniciar viagem
  const startTrip = useCallback(() => {
    setGettingLocation(true);
    toast.info("📍 Obtendo localização GPS do motorista...", { duration: 2000 });

    const tripData = state.trips.find((t: any) => t.id === tripId);
    if (!tripData) {
      setGettingLocation(false);
      toast.error("Viagem não encontrada.");
      return;
    }

    const beginWithLocation = (loc: google.maps.LatLngLiteral, isReal: boolean) => {
      setGettingLocation(false);
      setCurrentPos(loc);
      lastPosRef.current = loc;

      // Atualizar status no mock
      const tripIndex = state.trips.findIndex((t: any) => t.id === tripId);
      if (tripIndex !== -1) {
        state.trips[tripIndex] = { ...state.trips[tripIndex], status: "em_andamento" };
        notify();
      }

      const dest = tripData.origem;
      setStageDestination(dest);
      setStage("indo_coleta");
      stageRef.current = "indo_coleta";
      setIsTracking(true);

      if (isReal) {
        toast.success("🛰️ GPS real ativo! Rastreando posição do motorista.", { duration: 3000 });
      } else {
        toast.info("📍 GPS indisponível. Usando modo simulado.", { duration: 3000 });
      }

      // Traçar rota da posição atual até o ponto de coleta
      traceRoute(loc, dest, "indo_coleta", () => {
        if (isReal) {
          // GPS real: watchPosition atualiza posição continuamente
          startGPSTracking(loc);
        } else {
          // Fallback: simular movimento suave pela rota
          startSimulatedTracking();
        }
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          beginWithLocation(loc, true);
        },
        () => {
          // Fallback: posição simulada próxima à cidade de origem
          const fallback = { lat: -23.6273, lng: -46.6566 };
          beginWithLocation(fallback, false);
        },
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      const fallback = { lat: -23.6273, lng: -46.6566 };
      beginWithLocation(fallback, false);
    }
  }, [tripId, traceRoute, startGPSTracking]);

  // ── Finalizar viagem manualmente
  const finishTrip = useCallback(() => {
    stopGPS();
    if (timerRef.current) clearInterval(timerRef.current);

    const tripIndex = state.trips.findIndex((t: any) => t.id === tripId);
    if (tripIndex !== -1) {
      state.trips[tripIndex] = { ...state.trips[tripIndex], status: "concluida" };
      notify();
    }

    setStage("concluida");
    setIsTracking(false);
    setTotalProgress(100);
    setCurrentSpeed(0);
    toast.success("✅ Viagem finalizada!", { duration: 4000 });
  }, [tripId, stopGPS]);

  // ── Inicializar mapa
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (!window.google?.maps) return;

    // Estilo dark premium
    map.setOptions({
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0f1729" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f1729" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
        { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9d2d3" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a2744" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
        { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1a4a6b" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0d3349" }] },
        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5df" }] },
        { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d1a" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    if (!trip?.origem) return;

    // Criar marcador do veículo
    try {
      const icon = createVehicleIcon("aguardando");
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: -23.5505, lng: -46.6333 },
        content: icon,
        title: vehicle?.placa || "Veículo",
        zIndex: 999,
      });
      markerElRef.current = icon as any;
    } catch (e) {
      console.warn("AdvancedMarker não disponível:", e);
    }

    // Mostrar visão geral da rota (origem → destino) enquanto aguarda início
    const overviewRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#334155",
        strokeWeight: 4,
        strokeOpacity: 0.5,
        geodesic: true,
      },
    });

    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: trip.origem,
        destination: trip.destino,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          overviewRenderer.setDirections(result);
          rendererRef.current = overviewRenderer;
          const leg = result.routes[0].legs[0];
          if (leg?.duration?.value) setEtaMinutes(Math.ceil(leg.duration.value / 60));
          if (leg?.distance?.value) setDistanceTotal(Math.round(leg.distance.value / 1000));

          // Marcadores de origem e destino
          const addMarker = (pos: google.maps.LatLng, color: string, label: string) => {
            const el = document.createElement("div");
            el.innerHTML = `
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px ${color}88;"></div>
                <div style="background:rgba(0,0,0,0.8);color:white;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;border:1px solid ${color}44;">${label}</div>
              </div>`;
            try {
              new google.maps.marker.AdvancedMarkerElement({ map, position: pos, content: el });
            } catch { /* fallback */ }
          };

          addMarker(leg.start_location, "#22c55e", "📦 Coleta");
          addMarker(leg.end_location, "#ef4444", "🏁 Entrega");

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
          map.fitBounds(bounds, { top: 80, bottom: 240, left: 40, right: 40 });
        }
      }
    );
  }, [trip, vehicle, createVehicleIcon]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopGPS();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopGPS]);

  // ── Compartilhar
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Rastreamento #${(trip as any)?.numeroViagem}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copiado!");
      }
    } catch { /* ignorar */ }
  };

  const stageConfig = STAGE_CONFIGS[stage];
  const stageOrder: TripStage[] = ["indo_coleta", "indo_entrega", "retornando_base", "retornando_garagem"];
  const currentStageIndex = stageOrder.indexOf(stage);

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Carregando viagem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">

      {/* ── Mapa fullscreen ── */}
      <div className="absolute inset-0">
        <MapView
          initialCenter={{ lat: -23.5505, lng: -46.6333 }}
          initialZoom={8}
          onMapReady={handleMapReady}
          className="w-full h-full"
        />
      </div>

      {/* ── Header flutuante ── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          className="bg-slate-900/90 backdrop-blur-xl border-white/10 text-white hover:bg-slate-800 shadow-2xl rounded-full px-4 h-10"
          onClick={() => setLocation("/trips")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center gap-2">
          {/* Indicador GPS */}
          {isTracking && (
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              backdrop-blur-xl shadow-xl border
              ${gpsActive
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                : "bg-amber-500/20 text-amber-300 border-amber-400/30"
              }
            `}>
              {gpsActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {gpsActive
                ? `GPS real ${gpsAccuracy ? `±${gpsAccuracy}m` : ""}`
                : "Modo simulado"}
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="bg-slate-900/90 backdrop-blur-xl border-white/10 text-white hover:bg-slate-800 shadow-2xl rounded-full h-10 w-10 p-0"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Badge de status flutuante ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className={`
          px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl backdrop-blur-xl
          ${stageConfig.bgColor} ${stageConfig.color} border ${stageConfig.borderColor}
          ${isTracking ? "animate-pulse" : ""}
        `}>
          <span className="flex items-center gap-2">
            {stageConfig.icon}
            {stageConfig.label}
          </span>
        </div>
      </div>

      {/* ── Painel inferior estilo Uber ── */}
      <div className={`
        absolute bottom-0 left-0 right-0 z-30 transition-all duration-300
        ${panelExpanded ? "max-h-[75vh]" : "max-h-[160px]"}
      `}>
        <div
          className="flex justify-center pt-3 pb-1 cursor-pointer"
          onClick={() => setPanelExpanded(!panelExpanded)}
        >
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        <div className="bg-slate-900/97 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[inherit]">

          <button
            className="w-full flex items-center justify-center py-1 text-white/40 hover:text-white/70 transition-colors"
            onClick={() => setPanelExpanded(!panelExpanded)}
          >
            {panelExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <div className="px-5 pb-6">

            {/* ── Rota atual da etapa ── */}
            {stage !== "aguardando" && stage !== "concluida" && (
              <div className="flex items-center gap-3 mb-4 bg-white/5 rounded-2xl p-3 border border-white/5">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${
                    stage === "indo_coleta" ? "bg-amber-400" :
                    stage === "indo_entrega" ? "bg-indigo-400" :
                    stage === "retornando_base" ? "bg-purple-400" : "bg-emerald-400"
                  }`} />
                  <div className="w-0.5 h-6 bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/40 mb-0.5">{stageConfig.fromLabel}</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {stage === "indo_coleta" ? "Localização atual (GPS)" :
                     stage === "indo_entrega" ? trip.origem :
                     stage === "retornando_base" ? trip.destino :
                     trip.origem}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowRight className="w-3 h-3 text-white/30" />
                  </div>
                  <p className="text-[11px] text-white/40 mb-0.5 mt-1">{stageConfig.toLabel}</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {stage === "indo_coleta" ? trip.origem :
                     stage === "indo_entrega" ? trip.destino :
                     stage === "retornando_base" ? trip.origem :
                     getGaragem()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{etaMinutes}</p>
                  <p className="text-[10px] text-white/40">min ETA</p>
                </div>
              </div>
            )}

            {/* ── Barra de progresso (4 etapas) ── */}
            <div className="mb-4">
              <div className="flex items-center gap-1 mb-2">
                {stageOrder.map((s, i) => {
                  const isCompleted = currentStageIndex > i || stage === "concluida";
                  const isCurrent = currentStageIndex === i && stage !== "concluida";
                  const stageColors = ["bg-amber-400", "bg-indigo-400", "bg-purple-400", "bg-emerald-400"];
                  const stageIcons = [
                    <Navigation className="w-3 h-3" />,
                    <Truck className="w-3 h-3" />,
                    <Route className="w-3 h-3" />,
                    <Home className="w-3 h-3" />,
                  ];
                  const stageLabels = ["Coleta", "Entrega", "Retorno", "Garagem"];

                  return (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-500
                        ${isCompleted
                          ? `${stageColors[i]} border-transparent text-white`
                          : isCurrent
                          ? `bg-white/10 ${stageColors[i].replace("bg-", "border-")} text-white`
                          : "bg-white/5 border-white/10 text-white/30"}
                      `}>
                        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : stageIcons[i]}
                      </div>
                      <span className={`text-[9px] font-medium ${
                        isCurrent ? "text-white" : isCompleted ? "text-white/60" : "text-white/25"
                      }`}>
                        {stageLabels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${stage === "concluida" ? 100 : totalProgress}%`,
                    background: "linear-gradient(90deg, #f59e0b 0%, #6366f1 33%, #a855f7 66%, #22c55e 100%)",
                    boxShadow: "0 0 10px rgba(99,102,241,0.4)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30">
                  {(stage === "concluida" ? 100 : totalProgress).toFixed(0)}% concluído
                </span>
                <span className="text-[10px] text-white/30">
                  {stage === "concluida" ? "Finalizado" : stageConfig.sublabel}
                </span>
              </div>
            </div>

            {/* ── Stats em tempo real ── */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Gauge className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">{isTracking ? currentSpeed : 0}</p>
                <p className="text-[10px] text-white/40">km/h</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Route className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">{distanceCovered}</p>
                <p className="text-[10px] text-white/40">km feitos</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Timer className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">{formatTime(elapsedTime)}</p>
                <p className="text-[10px] text-white/40">decorrido</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Navigation className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">
                  {Math.max(0, distanceTotal - distanceCovered)}
                </p>
                <p className="text-[10px] text-white/40">km restam</p>
              </div>
            </div>

            {/* ── Conteúdo expandido ── */}
            {panelExpanded && (
              <div className="space-y-3 animate-in fade-in duration-300">

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/40">Motorista</p>
                        <p className="text-sm font-bold text-white truncate">{driver?.nome || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/40">Veículo</p>
                        <p className="text-sm font-bold text-white truncate">{vehicle?.placa || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/40">Carga</p>
                        <p className="text-sm font-bold text-white truncate">{(trip as any)?.carga || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/40">Valor</p>
                        <p className="text-sm font-bold text-white truncate">
                          R$ {parseFloat((trip as any)?.valor || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coordenadas GPS em tempo real */}
                {gpsActive && currentPos && (
                  <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-400/20">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-emerald-400/70">Posição GPS Real</p>
                        <p className="text-xs font-mono text-emerald-300">
                          {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}
                        </p>
                        {gpsAccuracy && (
                          <p className="text-[10px] text-emerald-400/50">Precisão: ±{gpsAccuracy}m</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/40">Garagem</p>
                      <p className="text-sm font-medium text-white/80 truncate">{getGaragem()}</p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── Botão de ação ── */}
            <div className="mt-4">
              {stage === "aguardando" && (
                <Button
                  className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 border-0"
                  onClick={startTrip}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Obtendo GPS...</>
                  ) : (
                    <><Play className="w-5 h-5 mr-2" /> INICIAR VIAGEM</>
                  )}
                </Button>
              )}

              {(stage === "indo_coleta" || stage === "indo_entrega" || stage === "retornando_base" || stage === "retornando_garagem") && (
                <Button
                  className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/30 border-0"
                  onClick={finishTrip}
                >
                  <Square className="w-5 h-5 mr-2" /> FINALIZAR VIAGEM
                </Button>
              )}

              {stage === "concluida" && (
                <Button
                  className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  onClick={() => setLocation("/trips")}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" /> VER TODAS AS VIAGENS
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
