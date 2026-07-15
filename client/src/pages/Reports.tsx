import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, DollarSign } from "lucide-react";
import { formatPlaca } from "@/lib/format";
import { exportTablePDF } from "@/lib/exportPdf";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Helper: monta CSV de um array de objetos e dispara download
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    toast.error("Não há dados para exportar.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Anti CSV/formula-injection: célula que começa com = + - @ (ou TAB/CR)
    // vira fórmula no Excel/Sheets. Prefixa com aspa simples pra neutralizar.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvBody =
    headers.join(",") +
    "\n" +
    rows.map(r => headers.map(h => escape(r[h])).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Arquivo exportado: ${filename}`);
}

const formatDateBR = (d: any) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "";

export default function Reports() {
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const { data: drivers } = trpc.drivers.list.useQuery();
  const { data: trips } = trpc.trips.list.useQuery();
  const { data: maintenances } = trpc.maintenance.list.useQuery();

  const [reportPeriod, setReportPeriod] = useState("6months");

  // Filtra por período
  const periodMs = (() => {
    const day = 24 * 60 * 60 * 1000;
    switch (reportPeriod) {
      case "1month":
        return 30 * day;
      case "3months":
        return 90 * day;
      case "1year":
        return 365 * day;
      case "6months":
      default:
        return 180 * day;
    }
  })();
  const periodStart = Date.now() - periodMs;
  const sinceDays =
    reportPeriod === "1month"
      ? 30
      : reportPeriod === "3months"
        ? 90
        : reportPeriod === "1year"
          ? 365
          : 180;

  const tripsInPeriod = (trips || []).filter(
    (t: any) => new Date(t.dataPartida).getTime() >= periodStart
  );
  const maintenancesInPeriod = (maintenances || []).filter(
    (m: any) =>
      new Date(m.dataRealizada || m.dataPrevista).getTime() >= periodStart
  );

  // Financeiro CONSOLIDADO (mesma fonte única da tela Financeiro): receita =
  // viagens concluídas + receitas manuais; despesa = manutenção concluída +
  // despesas manuais. Respeita o período selecionado.
  const { data: fin, isLoading } = trpc.dashboard.financeSummary.useQuery({
    sinceDays,
  });
  const totalRevenue = fin?.receitas ?? 0;
  const totalCosts = fin?.despesas ?? 0;
  const profit = fin?.saldo ?? 0;
  const financialData = fin?.monthly ?? [];

  // Status de viagens
  const tripStatusData = [
    {
      name: "Planejadas",
      value: trips?.filter((t: any) => t.status === "planejada").length || 0,
      color: "#3b82f6",
    },
    {
      name: "Em Andamento",
      value: trips?.filter((t: any) => t.status === "em_andamento").length || 0,
      color: "#8b5cf6",
    },
    {
      name: "Concluídas",
      value: trips?.filter((t: any) => t.status === "concluida").length || 0,
      color: "#10b981",
    },
    {
      name: "Canceladas",
      value: trips?.filter((t: any) => t.status === "cancelada").length || 0,
      color: "#ef4444",
    },
  ];

  // Monta título + linhas de um relatório (usado tanto no CSV quanto no PDF).
  const buildReport = (
    reportType: string
  ): {
    title: string;
    filename: string;
    rows: Record<string, any>[];
  } | null => {
    if (!vehicles || !drivers || !trips || !maintenances) return null;
    if (reportType === "frota") {
      return {
        title: "Relatório de Frota",
        filename: "frota",
        rows: vehicles.map((v: any) => ({
          ID: v.id,
          Placa: formatPlaca(v.placa),
          Marca: v.marca,
          Modelo: v.modelo,
          Ano: v.ano,
          Tipo: v.tipo,
          Status: v.status,
          Quilometragem: v.quilometragem ?? "",
          CapacidadeCargaKg: v.capacidadeCarga ?? "",
          VencimentoCRLV: formatDateBR(v.crlvVencimento),
          VencimentoSeguro: formatDateBR(v.seguroVencimento),
        })),
      };
    }
    if (reportType === "viagens") {
      return {
        title: "Relatório de Viagens",
        filename: "viagens",
        rows: tripsInPeriod.map((t: any) => {
          const veh = vehicles.find((v: any) => v.id === t.veiculoId);
          const drv = drivers.find((d: any) => d.id === t.motoristaId);
          return {
            ID: t.id,
            Numero: t.numeroViagem,
            Status: t.status,
            Origem: t.origem,
            Destino: t.destino,
            DataPartida: formatDateBR(t.dataPartida),
            DataChegada: formatDateBR(t.dataChegada),
            Veiculo: veh
              ? `${formatPlaca(veh.placa)} (${veh.marca} ${veh.modelo})`
              : "",
            Motorista: drv?.nome || "",
            DistanciaKm: t.distancia ?? "",
            ValorBRL: t.valor ?? "",
          };
        }),
      };
    }
    if (reportType === "manutencoes") {
      return {
        title: "Relatório de Manutenções",
        filename: "manutencoes",
        rows: maintenancesInPeriod.map((m: any) => {
          const veh = vehicles.find((v: any) => v.id === m.veiculoId);
          return {
            ID: m.id,
            Veiculo: veh
              ? `${formatPlaca(veh.placa)} (${veh.marca} ${veh.modelo})`
              : "",
            Tipo: m.tipo,
            Status: m.status,
            DataPrevista: formatDateBR(m.dataPrevista),
            DataRealizada: formatDateBR(m.dataRealizada),
            CustoBRL: m.custo ?? "",
            Descricao: m.descricao || "",
          };
        }),
      };
    }
    if (reportType === "financeiro") {
      return {
        title: "Relatório Financeiro (mensal)",
        filename: "financeiro",
        rows: financialData.map((row: any) => ({
          Mes: row.month,
          ReceitaBRL: row.receita.toFixed(2),
          DespesasBRL: row.custos.toFixed(2),
          LucroBRL: row.lucro.toFixed(2),
        })),
      };
    }
    return null;
  };

  const handleExport = (reportType: string, fmt: "csv" | "pdf") => {
    const rep = buildReport(reportType);
    if (!rep) {
      toast.error("Carregando dados, tente novamente em alguns instantes.");
      return;
    }
    if (rep.rows.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (fmt === "csv") {
      downloadCSV(`${rep.filename}-${today}.csv`, rep.rows);
    } else if (
      exportTablePDF(`${rep.title} — ${formatDateBR(new Date())}`, rep.rows)
    ) {
      toast.success("Abrindo PDF para impressão/salvamento…");
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios e Análises</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de desempenho operacional e financeiro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Último mês</SelectItem>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="1year">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <FileText className="w-3 h-3 mr-1" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Botões de exportação por categoria (CSV e PDF) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exportar Dados</CardTitle>
          <CardDescription className="text-xs">
            CSV abre no Excel / Google Sheets. PDF abre a tela de impressão —
            escolha "Salvar como PDF".
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            { key: "frota", label: "Frota" },
            { key: "viagens", label: "Viagens" },
            { key: "manutencoes", label: "Manutenções" },
            { key: "financeiro", label: "Financeiro" },
          ].map(cat => (
            <div
              key={cat.key}
              className="flex items-center gap-1 rounded-lg border px-2 py-1"
            >
              <span className="text-sm font-medium mr-1">{cat.label}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => handleExport(cat.key, "csv")}
              >
                <Download className="w-3 h-3 mr-1" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => handleExport(cat.key, "pdf")}
              >
                <FileText className="w-3 h-3 mr-1" />
                PDF
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Receita (período)
                </p>
                <p className="text-2xl font-bold text-green-600">
                  R${" "}
                  {totalRevenue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Despesas (período)
                </p>
                <p className="text-2xl font-bold text-red-600">
                  R${" "}
                  {totalCosts.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Lucro Operacional
                </p>
                <p
                  className={`text-2xl font-bold ${
                    profit >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  R${" "}
                  {profit.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  profit >= 0
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Análise Financeira</CardTitle>
          <CardDescription className="text-xs">
            Receitas, custos e lucros mensais
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {financialData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sem dados financeiros para o período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Receita"
                />
                <Line
                  type="monotone"
                  dataKey="custos"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Custos"
                />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Lucro"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Trip Status Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Status das Viagens</CardTitle>
          <CardDescription className="text-xs">
            Distribuição por status atual
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {tripStatusData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nenhuma viagem cadastrada.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tripStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {tripStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
