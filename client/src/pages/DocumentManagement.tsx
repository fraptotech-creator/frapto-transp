import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FileText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type DocItem = {
  entityId: number;
  entityKind: "veiculo" | "motorista";
  entityName: string;
  docType: string;
  vencimento: Date | null;
};

const formatDate = (d: Date | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
};

const getStatus = (vencimento: Date | null) => {
  if (!vencimento) return "sem_data";
  const now = Date.now();
  const venc = new Date(vencimento).getTime();
  const days = (venc - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return "vencido";
  if (days <= 30) return "proximo";
  return "ok";
};

const statusBadge = (status: string) => {
  switch (status) {
    case "vencido":
      return {
        label: "Vencido",
        cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: AlertTriangle,
      };
    case "proximo":
      return {
        label: "Vence em breve",
        cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        icon: Clock,
      };
    case "sem_data":
      return {
        label: "Sem data",
        cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        icon: FileText,
      };
    default:
      return {
        label: "Em dia",
        cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircle2,
      };
  }
};

export default function DocumentManagement() {
  const { data: vehicles, isLoading: loadingV } = trpc.vehicles.list.useQuery();
  const { data: drivers, isLoading: loadingD } = trpc.drivers.list.useQuery();

  const isLoading = loadingV || loadingD;

  // Monta lista unificada de documentos a partir de veículos e motoristas
  const docs: DocItem[] = [];

  vehicles?.forEach((v: any) => {
    if (v.crlvVencimento) {
      docs.push({
        entityId: v.id,
        entityKind: "veiculo",
        entityName: `${v.placa} - ${v.marca} ${v.modelo}`,
        docType: "CRLV",
        vencimento: new Date(v.crlvVencimento),
      });
    }
    if (v.seguroVencimento) {
      docs.push({
        entityId: v.id,
        entityKind: "veiculo",
        entityName: `${v.placa} - ${v.marca} ${v.modelo}`,
        docType: "Seguro",
        vencimento: new Date(v.seguroVencimento),
      });
    }
  });

  drivers?.forEach((d: any) => {
    if (d.cnhVencimento) {
      docs.push({
        entityId: d.id,
        entityKind: "motorista",
        entityName: d.nome,
        docType: `CNH (${d.cnhCategoria})`,
        vencimento: new Date(d.cnhVencimento),
      });
    }
  });

  const sortKey = (d: DocItem) =>
    d.vencimento ? new Date(d.vencimento).getTime() : Number.MAX_SAFE_INTEGER;
  docs.sort((a, b) => sortKey(a) - sortKey(b));

  const vencidos = docs.filter((d) => getStatus(d.vencimento) === "vencido");
  const proximos = docs.filter((d) => getStatus(d.vencimento) === "proximo");
  const emDia = docs.filter((d) => getStatus(d.vencimento) === "ok");

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const renderList = (list: DocItem[]) => {
    if (list.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum documento nesta categoria.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {list.map((doc, i) => {
          const status = getStatus(doc.vencimento);
          const badge = statusBadge(status);
          const Icon = badge.icon;
          return (
            <div
              key={`${doc.entityKind}-${doc.entityId}-${doc.docType}-${i}`}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {doc.docType} —{" "}
                  <span className="capitalize">{doc.entityKind}</span>:{" "}
                  {doc.entityName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vencimento: {formatDate(doc.vencimento)}
                </p>
              </div>
              <Badge className={`${badge.cls} flex items-center gap-1 whitespace-nowrap`}>
                <Icon className="w-3 h-3" />
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Gestão de Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe vencimentos de CRLV, seguro e CNH
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Vencidos</p>
            <p className="text-2xl font-bold text-red-600">{vencidos.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Vencendo em até 30 dias
            </p>
            <p className="text-2xl font-bold text-amber-600">
              {proximos.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Em dia</p>
            <p className="text-2xl font-bold text-emerald-600">
              {emDia.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Documentos Vencidos</CardTitle>
          <CardDescription className="text-xs">
            Estes documentos precisam de ação imediata
          </CardDescription>
        </CardHeader>
        <CardContent>{renderList(vencidos)}</CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Vencendo em até 30 dias</CardTitle>
          <CardDescription className="text-xs">
            Programe a renovação para evitar problemas operacionais
          </CardDescription>
        </CardHeader>
        <CardContent>{renderList(proximos)}</CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Em dia</CardTitle>
          <CardDescription className="text-xs">
            Documentos com vencimento futuro tranquilo
          </CardDescription>
        </CardHeader>
        <CardContent>{renderList(emDia)}</CardContent>
      </Card>
    </div>
  );
}
