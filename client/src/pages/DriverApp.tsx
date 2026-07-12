import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";
import { wazeUrl } from "@/lib/nav";
import { Truck, MapPin, LogOut, Navigation, Clock } from "lucide-react";

// Data/hora atual no formato do input datetime-local (hora local).
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fmt = (d: unknown) =>
  d
    ? new Date(d as string).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export default function DriverApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-4 space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!user || user.orgRole !== "driver") return <DriverLogin />;
  if (user.mustChangePassword) return <ChangePassword firstAccess />;
  return <DriverHome name={user.name ?? "Motorista"} />;
}

// ─── Login ───────────────────────────────────────────────────────────────────
function DriverLogin() {
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.loginDriver.useMutation({
    onSuccess: async () => {
      await refresh();
    },
    onError: (e: any) =>
      showErrorDialog(
        e.message || "Falha ao entrar",
        "Não foi possível entrar"
      ),
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <CardTitle>Área do Motorista</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="seu usuário"
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="sua senha"
              onKeyDown={e => {
                if (e.key === "Enter" && username && password)
                  login.mutate({ username, password });
              }}
            />
          </div>
          <Button
            className="w-full"
            disabled={login.isPending || !username || !password}
            onClick={() => login.mutate({ username, password })}
          >
            {login.isPending ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Primeiro acesso? Use a senha inicial informada pela empresa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Troca de senha (1º acesso / a qualquer momento) ─────────────────────────
function ChangePassword({ firstAccess }: { firstAccess?: boolean }) {
  const { refresh, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      toast.success("Senha alterada!");
      await refresh();
    },
    onError: (e: any) =>
      showErrorDialog(e.message || "Falha ao trocar a senha", "Erro"),
  });

  const submit = () => {
    if (next.length < 4) {
      showErrorDialog("A nova senha precisa de ao menos 4 caracteres.", "Erro");
      return;
    }
    if (next !== confirm) {
      showErrorDialog("A confirmação não confere com a nova senha.", "Erro");
      return;
    }
    change.mutate({ currentPassword: current, newPassword: next });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {firstAccess ? "Defina sua senha" : "Trocar senha"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {firstAccess && (
            <p className="text-sm text-muted-foreground">
              É seu primeiro acesso — crie uma senha só sua.
            </p>
          )}
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={change.isPending || !current || !next || !confirm}
            onClick={submit}
          >
            {change.isPending ? "Salvando..." : "Salvar nova senha"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Home: minhas viagens ────────────────────────────────────────────────────
function DriverHome({ name }: { name: string }) {
  const { logout } = useAuth();
  const { data: trips, isLoading, refetch } = trpc.driverApp.myTrips.useQuery();

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold leading-tight">Minhas Viagens</p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => logout()}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : trips && trips.length > 0 ? (
        trips.map(trip => (
          <TripCard key={trip.id} trip={trip} onChange={() => refetch()} />
        ))
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma viagem atribuída a você.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TripCard({ trip, onChange }: { trip: any; onChange: () => void }) {
  const [chegada, setChegada] = useState(nowLocalInput());
  const start = trpc.driverApp.startTrip.useMutation({
    onSuccess: () => {
      toast.success("Viagem iniciada!");
      onChange();
    },
    onError: (e: any) => showErrorDialog(e.message, "Erro"),
  });
  const complete = trpc.driverApp.completeTrip.useMutation({
    onSuccess: () => {
      toast.success("Viagem concluída!");
      onChange();
    },
    onError: (e: any) => showErrorDialog(e.message, "Erro"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{trip.numeroViagem}</CardTitle>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted">
            {STATUS_LABEL[trip.status] ?? trip.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div>
            <p>
              <strong>Origem:</strong> {trip.origem}
            </p>
            <p>
              <strong>Destino:</strong> {trip.destino}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" /> Partida: {fmt(trip.dataPartida)}
        </div>
        {trip.previsaoChegada && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Navigation className="w-3 h-3" /> Chegada prevista:{" "}
            {fmt(trip.previsaoChegada)}
          </div>
        )}
        {trip.carga && (
          <p className="text-xs">
            <strong>Carga:</strong> {trip.carga}
          </p>
        )}
        {trip.status === "concluida" && (
          <p className="text-xs text-emerald-600">
            Chegada registrada: {fmt(trip.dataChegada)}
          </p>
        )}

        {/* Navegação (abre o Waze já navegando) */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(wazeUrl(trip.origem), "_blank")}
          >
            <Navigation className="w-4 h-4 mr-1" /> Origem
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(wazeUrl(trip.destino), "_blank")}
          >
            <Navigation className="w-4 h-4 mr-1" /> Destino
          </Button>
        </div>

        {trip.status === "planejada" && (
          <Button
            className="w-full"
            disabled={start.isPending}
            onClick={() => start.mutate({ id: trip.id })}
          >
            {start.isPending ? "Iniciando..." : "Iniciar viagem"}
          </Button>
        )}

        {trip.status === "em_andamento" && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs">Data e hora de chegada no cliente</Label>
            <Input
              type="datetime-local"
              value={chegada}
              onChange={e => setChegada(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={complete.isPending || !chegada}
              onClick={() =>
                complete.mutate({ id: trip.id, dataChegada: new Date(chegada) })
              }
            >
              {complete.isPending ? "Concluindo..." : "Concluir viagem"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
