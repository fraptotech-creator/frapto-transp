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
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Truck, Users, MapPin, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { contemTexto } from "@/lib/searchFilters";
import { rotuloAssinatura, corAssinatura } from "@/lib/subscriptionLabel";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

export default function PlatformAdmin() {
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = trpc.superAdmin.overview.useQuery();

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

  const orgs = data.orgs.filter(o => contemTexto(o.name, busca));

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
            placeholder="Buscar empresa pelo nome..."
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
                  <th className="py-2 pr-4">Assinatura</th>
                  <th className="py-2 pr-4">Plano</th>
                  <th className="py-2 pr-4 text-right">Usuários</th>
                  <th className="py-2 pr-4 text-right">Veículos</th>
                  <th className="py-2 pr-4 text-right">Motoristas</th>
                  <th className="py-2 pr-4 text-right">Viagens</th>
                  <th className="py-2 pr-4">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{o.name}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={corAssinatura(o.subscriptionStatus)}>
                        {rotuloAssinatura(o.subscriptionStatus)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{o.planName ?? "—"}</td>
                    <td className="py-2 pr-4 text-right">{o.usuarios}</td>
                    <td className="py-2 pr-4 text-right">{o.veiculos}</td>
                    <td className="py-2 pr-4 text-right">{o.motoristas}</td>
                    <td className="py-2 pr-4 text-right">{o.viagens}</td>
                    <td className="py-2 pr-4">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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
    </div>
  );
}
