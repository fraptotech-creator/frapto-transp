import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FileText, Upload, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DocType = "crlv" | "seguro" | "cnh" | "rg" | "cpf" | "outro";
const TIPO_LABEL: Record<DocType, string> = {
  crlv: "CRLV",
  seguro: "Seguro",
  cnh: "CNH",
  rg: "RG",
  cpf: "CPF",
  outro: "Outro",
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DocumentManagement() {
  const { data: status } = trpc.documents.status.useQuery();
  const { data: docs, isLoading, refetch } = trpc.documents.list.useQuery();

  const uploadM = trpc.documents.upload.useMutation();
  const downloadM = trpc.documents.downloadUrl.useMutation();
  const deleteM = trpc.documents.delete.useMutation();

  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<DocType>("crlv");
  const [descricao, setDescricao] = useState("");

  const configured = status?.configured ?? false;

  const handleUpload = async () => {
    if (!file) {
      toast.error("Escolha um arquivo.");
      return;
    }
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadM.mutateAsync({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64,
        tipo,
        descricao: descricao || undefined,
      });
      toast.success("Documento enviado!");
      setFile(null);
      setDescricao("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const { url } = await downloadM.mutateAsync({ id });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este documento?")) return;
    try {
      await deleteM.mutateAsync({ id });
      toast.success("Documento excluído.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Envie e guarde CRLV, CNH, seguro e outros arquivos da frota.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar documento</CardTitle>
          <CardDescription>PDF, JPG, PNG ou WEBP, até 10 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600">
              Armazenamento de arquivos ainda não configurado pelo administrador
              do sistema.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={tipo}
                    onValueChange={v => setTipo(v as DocType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_LABEL) as DocType[]).map(t => (
                        <SelectItem key={t} value={t}>
                          {TIPO_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Ex: CRLV 2026 - ABC1234"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadM.isPending || !file}
                className="w-full sm:w-auto"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadM.isPending ? "Enviando…" : "Enviar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos enviados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs && docs.length > 0 ? (
                  docs.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {TIPO_LABEL[d.tipo as DocType] ?? d.tipo}
                      </TableCell>
                      <TableCell>{d.descricao ?? "-"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(d.id)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-6"
                    >
                      Nenhum documento enviado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
