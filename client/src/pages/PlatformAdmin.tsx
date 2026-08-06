import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Truck,
  Users,
  MapPin,
  ShieldAlert,
  Check,
  Ban,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { contemTexto } from "@/lib/searchFilters";
import { rotuloAssinatura, corAssinatura } from "@/lib/subscriptionLabel";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

// Espelha temAcesso do servidor: override manual vence o Stripe.
function acessoEfetivo(o: {
  subscriptionStatus: string | null;
  accessOverride: "active" | "blocked" | null;
}) {
  if (o.accessOverride === "blocked") return false;
  if (o.accessOverride === "active") return true;
  return (
    o.subscriptionStatus === "active" || o.subscriptionStatus === "trialing"
  );
}

export default function PlatformAdmin() {
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState<{
    orgId: number;
    nome: string;
    acao: "liberar" | "bloquear" | "desbloquear";
    hasStripe: boolean;
  } | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.superAdmin.overview.useQuery();

  const setAccess = trpc.superAdmin.setAccess.useMutation({
    onSuccess: res => {
      toast.success(
        res.acao === "liberar"
          ? "Acesso liberado. A empresa já pode usar o sistema."
          : res.acao === "bloquear"
            ? "Acesso bloqueado."
            : "Desbloqueado. A empresa volta a seguir o Stripe."
      );
      utils.superAdmin.overview.invalidate();
      setConfirmando(null);
    },
    onError: e => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Acesso restrito
            </CardTitle>
            <CardDescription>
              Esta área é exclusiva do administrador da plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Busca pelo nome OU pelo email do dono — normalmente você lembra de um só.
  const orgs = data.orgs.filter(
    o => contemTexto(o.name, busca) || contemTexto(o.email ?? "", busca)
  );

  const cards = [
    { label: "Empresas", valor: data.totais.empresas, icon: Building2 },
    { label: "Assinaturas ativas", valor: data.totais.ativas, icon: Users },
    { label: "Veículos", valor: data.totais.veiculos, icon: Truck },
    { label: "Viagens", valor: data.totais.viagens, icon: MapPin },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração da plataforma</h1>
        <p className="text-muted-foreground">
          Visão de todas as empresas assinantes do Frapto Transp.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-3">
                <c.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.valor}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>
            {data.totais.ativas} ativa(s) · {data.totais.inativas} sem
            assinatura ativa
          </CardDescription>
          <Input
            placeholder="Buscar por nome da empresa ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="max-w-sm mt-2"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Empresa</th>
                  <th className="py-2 pr-4">E-mail</th>
                  <th className="py-2 pr-4">Assinatura</th>
                  <th className="py-2 pr-4">Plano</th>
                  <th className="py-2 pr-4 text-right">Usuários</th>
                  <th className="py-2 pr-4 text-right">Veículos</th>
                  <th className="py-2 pr-4 text-right">Motoristas</th>
                  <th className="py-2 pr-4 text-right">Viagens</th>
                  <th className="py-2 pr-4">Cadastro</th>
                  <th className="py-2 text-right">Acesso</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{o.name}</td>
                    <td
                      className="py-2 pr-4 text-muted-foreground max-w-[220px] truncate"
                      title={o.email ?? undefined}
                    >
                      {o.email ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={corAssinatura(o.subscriptionStatus)}>
                        {rotuloAssinatura(o.subscriptionStatus)}
                      </Badge>
                      {o.accessOverride === "blocked" && (
                        <div className="mt-1 text-xs text-destructive">
                          bloqueado no admin
                        </div>
                      )}
                      {o.accessOverride === "active" && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          liberado no admin
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4">{o.planName ?? "—"}</td>
                    <td className="py-2 pr-4 text-right">{o.usuarios}</td>
                    <td className="py-2 pr-4 text-right">{o.veiculos}</td>
                    <td className="py-2 pr-4 text-right">{o.motoristas}</td>
                    <td className="py-2 pr-4 text-right">{o.viagens}</td>
                    <td className="py-2 pr-4">{formatDate(o.createdAt)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {o.accessOverride === "blocked" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmando({
                              orgId: o.id,
                              nome: o.name,
                              acao: "desbloquear",
                              hasStripe: o.hasStripeSubscription,
                            })
                          }
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Desbloquear
                        </Button>
                      ) : acessoEfetivo(o) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmando({
                              orgId: o.id,
                              nome: o.name,
                              acao: "bloquear",
                              hasStripe: o.hasStripeSubscription,
                            })
                          }
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Bloquear
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmando({
                              orgId: o.id,
                              nome: o.name,
                              acao: "liberar",
                              hasStripe: o.hasStripeSubscription,
                            })
                          }
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Liberar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-6 text-center text-muted-foreground"
                    >
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmando !== null}
        onOpenChange={aberto => !aberto && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando?.acao === "liberar"
                ? `Liberar ${confirmando?.nome}?`
                : confirmando?.acao === "bloquear"
                  ? `Bloquear ${confirmando?.nome}?`
                  : `Desbloquear ${confirmando?.nome}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando?.acao === "liberar"
                ? "A empresa passa a usar o sistema sem pagar pelo Stripe — use para quem pagou direto a você. Fica marcada como liberação manual."
                : confirmando?.acao === "bloquear"
                  ? "A empresa perde o acesso ao sistema imediatamente. Os dados dela não são apagados e você pode desbloquear depois."
                  : "Remove o bloqueio/liberação manual: a empresa volta a seguir a assinatura do Stripe."}
            </AlertDialogDescription>
            {confirmando?.acao === "bloquear" && confirmando?.hasStripe && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                ⚠️ Esta empresa assina pelo Stripe. Bloquear aqui corta o{" "}
                <strong>acesso</strong>, mas{" "}
                <strong>não cancela a cobrança</strong>. Para parar de cobrar,
                cancele a assinatura no painel do Stripe.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setAccess.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={setAccess.isPending}
              onClick={e => {
                e.preventDefault(); // fecha só depois do sucesso
                if (confirmando)
                  setAccess.mutate({
                    orgId: confirmando.orgId,
                    acao: confirmando.acao,
                  });
              }}
            >
              {setAccess.isPending
                ? "Aplicando..."
                : confirmando?.acao === "liberar"
                  ? "Liberar"
                  : confirmando?.acao === "bloquear"
                    ? "Bloquear"
                    : "Desbloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
