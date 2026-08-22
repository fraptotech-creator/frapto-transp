import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileDown, Users } from "lucide-react";
import { toast } from "sonner";
import { exportTablePDF } from "@/lib/exportPdf";
import { downloadCsvFile } from "@/lib/exportCsv";

type Passageiro = { nome: string; documento?: string; telefone?: string };

// Manifesto de embarque de uma viagem: cabeçalho (viagem/veículo/motorista/rota/
// data) + lista de passageiros, com exportação em PDF (impressão) e CSV.
export function ManifestoDialog({
  trip,
  open,
  onOpenChange,
}: {
  trip: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: vehicles } = trpc.vehicles.list.useQuery(undefined, {
    enabled: open,
  });
  const { data: drivers } = trpc.drivers.list.useQuery(undefined, {
    enabled: open,
  });

  const passageiros: Passageiro[] = (trip?.passageiros as Passageiro[]) ?? [];
  const veiculo = (vehicles ?? []).find(
    (v: any) => v.id === trip?.veiculoId
  ) as any | undefined;
  const motorista = (drivers ?? []).find(
    (d: any) => d.id === trip?.motoristaId
  ) as any | undefined;

  const placa = veiculo?.placa ?? "—";
  const motoristaNome = motorista?.nome ?? "—";
  const partida = trip?.dataPartida
    ? new Date(trip.dataPartida).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
  const capacidade: number | null = veiculo?.capacidadePassageiros ?? null;

  const contexto = [
    `Viagem: ${trip?.numeroViagem ?? "—"}`,
    `Veículo: ${placa}`,
    `Motorista: ${motoristaNome}`,
    `Rota: ${trip?.origem ?? "—"} → ${trip?.destino ?? "—"}`,
    `Partida: ${partida}`,
    `Passageiros: ${passageiros.length}${
      capacidade != null ? ` / ${capacidade}` : ""
    }`,
  ];

  const linhas = passageiros.map((p, i) => ({
    "#": i + 1,
    Nome: p.nome,
    Documento: p.documento || "",
    Telefone: p.telefone || "",
  }));

  const nomeArquivo = `manifesto-${(trip?.numeroViagem ?? "viagem").replace(
    /[^\w-]+/g,
    "_"
  )}`;

  const imprimir = () => {
    if (
      !exportTablePDF("Manifesto de embarque", linhas, contexto) &&
      linhas.length === 0
    ) {
      toast.error("Não há passageiros para imprimir.");
    }
  };
  const exportarCsv = () => {
    if (!downloadCsvFile(`${nomeArquivo}.csv`, linhas)) {
      toast.error("Não há passageiros para exportar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-emerald-400" />
            Manifesto de embarque — {trip?.numeroViagem ?? "viagem"}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground space-y-0.5">
          <p>
            <strong className="text-foreground">Veículo:</strong> {placa} ·{" "}
            <strong className="text-foreground">Motorista:</strong>{" "}
            {motoristaNome}
          </p>
          <p>
            <strong className="text-foreground">Rota:</strong> {trip?.origem} →{" "}
            {trip?.destino} ·{" "}
            <strong className="text-foreground">Partida:</strong> {partida}
          </p>
          <p>
            <strong className="text-foreground">Passageiros:</strong>{" "}
            {passageiros.length}
            {capacidade != null ? ` / ${capacidade}` : ""}
          </p>
        </div>

        {passageiros.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Esta viagem não tem passageiros cadastrados.
          </p>
        ) : (
          <div className="max-h-[45vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {passageiros.map((p, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.nome}</td>
                    <td className="px-3 py-2">{p.documento || "—"}</td>
                    <td className="px-3 py-2">{p.telefone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={exportarCsv}
            disabled={passageiros.length === 0}
          >
            <FileDown className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button
            size="sm"
            onClick={imprimir}
            disabled={passageiros.length === 0}
          >
            <Printer className="w-4 h-4 mr-1" /> Imprimir / PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
