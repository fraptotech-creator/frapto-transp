import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, Clock, Wrench } from "lucide-react";
import { formatPlaca } from "@/lib/format";
import { computeOilStatus, OIL_LABEL } from "@/lib/oil";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";

type MaintenanceStatus = "pendente" | "em_andamento" | "concluida";

const statusLabel = (status: string) => {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "em_andamento":
      return "Em Andamento";
    case "concluida":
      return "Concluída";
    default:
      return status;
  }
};

export default function Maintenance() {
  const [isOpen, setIsOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<any>(null);

  const emptyForm = {
    veiculoId: "",
    tipo: "",
    descricao: "",
    dataPrevista: "",
    custo: "",
    observacoes: "",
    status: "pendente" as MaintenanceStatus,
    dataRealizada: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const [statusFormData, setStatusFormData] = useState({
    status: "pendente" as MaintenanceStatus,
    dataRealizada: "",
    custo: "",
  });

  const {
    data: maintenances,
    isLoading,
    refetch,
  } = trpc.maintenance.list.useQuery();
  const { data: vehicles } = trpc.vehicles.list.useQuery();

  const createMutation = trpc.maintenance.create.useMutation({
    onSuccess: async (created: any) => {
      // Se o usuário escolheu um status diferente de "pendente" no cadastro,
      // ou definiu uma data de realização, atualiza imediatamente após criar.
      const needsStatusUpdate =
        (formData.status && formData.status !== "pendente") ||
        formData.dataRealizada;

      if (needsStatusUpdate && created?.id) {
        try {
          await updateStatusMutation.mutateAsync({
            id: created.id,
            status: formData.status,
            dataRealizada: formData.dataRealizada
              ? new Date(formData.dataRealizada)
              : undefined,
            custo: formData.custo || undefined,
          });
        } catch {
          // Erro já tratado no onError do updateStatusMutation
        }
      }

      toast.success("Manutenção cadastrada com sucesso!");
      setIsOpen(false);
      setFormData(emptyForm);
      refetch();
    },
    onError: (error: any) => {
      showErrorDialog(error.message || "Erro ao criar manutenção", "Erro");
    },
  });

  const updateStatusMutation = trpc.maintenance.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      setIsStatusDialogOpen(false);
      setSelectedMaintenance(null);
      refetch();
    },
    onError: (error: any) => {
      showErrorDialog(error.message || "Erro ao atualizar status", "Erro");
    },
  });

  const handleSubmit = () => {
    if (
      !formData.veiculoId ||
      !formData.tipo ||
      !formData.descricao ||
      !formData.dataPrevista
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Se status for "concluida" exige data de realização
    if (formData.status === "concluida" && !formData.dataRealizada) {
      toast.error("Informe a data de realização para concluir a manutenção.");
      return;
    }

    createMutation.mutate({
      veiculoId: parseInt(formData.veiculoId),
      tipo: formData.tipo,
      descricao: formData.descricao,
      dataPrevista: new Date(formData.dataPrevista),
      custo: formData.custo || undefined,
      observacoes: formData.observacoes || undefined,
    });
  };

  const handleStatusUpdate = () => {
    if (!selectedMaintenance) return;
    if (
      statusFormData.status === "concluida" &&
      !statusFormData.dataRealizada
    ) {
      toast.error("Informe a data de realização para concluir a manutenção.");
      return;
    }

    updateStatusMutation.mutate({
      id: selectedMaintenance.id,
      status: statusFormData.status,
      dataRealizada: statusFormData.dataRealizada
        ? new Date(statusFormData.dataRealizada)
        : undefined,
      custo: statusFormData.custo || undefined,
    });
  };

  const openStatusDialog = (maintenance: any) => {
    setSelectedMaintenance(maintenance);
    setStatusFormData({
      status: maintenance.status,
      dataRealizada: maintenance.dataRealizada
        ? new Date(maintenance.dataRealizada).toISOString().split("T")[0]
        : "",
      custo: maintenance.custo || "",
    });
    setIsStatusDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; icon: any }> = {
      pendente: {
        class:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        icon: Clock,
      },
      em_andamento: {
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        icon: Wrench,
      },
      concluida: {
        class:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircle,
      },
    };
    return badges[status] || badges.pendente;
  };

  const getVehicleName = (veiculoId: number) => {
    const vehicle = vehicles?.find((v: any) => v.id === veiculoId);
    return vehicle
      ? `${formatPlaca(vehicle.placa)} - ${vehicle.marca} ${vehicle.modelo}`
      : "Veículo não encontrado";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenção</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gerenciar manutenções de veículos
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setFormData(emptyForm);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Manutenção</DialogTitle>
              <DialogDescription>
                Agende uma nova manutenção para um veículo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="veiculoId">Veículo *</Label>
                <Select
                  value={formData.veiculoId}
                  onValueChange={value =>
                    setFormData({ ...formData, veiculoId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles?.map((vehicle: any) => (
                      <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                        {formatPlaca(vehicle.placa)} - {vehicle.marca}{" "}
                        {vehicle.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tipo">Tipo de Manutenção *</Label>
                <Input
                  id="tipo"
                  placeholder="Ex: Troca de óleo, Revisão, Reparo"
                  value={formData.tipo}
                  onChange={e =>
                    setFormData({ ...formData, tipo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva os detalhes da manutenção"
                  value={formData.descricao}
                  onChange={e =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dataPrevista">Data Prevista *</Label>
                  <Input
                    id="dataPrevista"
                    type="date"
                    value={formData.dataPrevista}
                    onChange={e =>
                      setFormData({ ...formData, dataPrevista: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(formData.status === "em_andamento" ||
                formData.status === "concluida") && (
                <div>
                  <Label htmlFor="dataRealizada">
                    Data de Realização
                    {formData.status === "concluida" ? " *" : ""}
                  </Label>
                  <Input
                    id="dataRealizada"
                    type="date"
                    value={formData.dataRealizada}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        dataRealizada: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div>
                <Label htmlFor="custo">
                  {formData.status === "concluida"
                    ? "Custo Final (R$)"
                    : "Custo Estimado (R$)"}
                </Label>
                <Input
                  id="custo"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.custo}
                  onChange={e =>
                    setFormData({ ...formData, custo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Informações adicionais"
                  value={formData.observacoes}
                  onChange={e =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending || updateStatusMutation.isPending
                }
                className="w-full"
              >
                {createMutation.isPending || updateStatusMutation.isPending
                  ? "Salvando..."
                  : "Cadastrar Manutenção"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alertas de troca de óleo por km */}
      {(() => {
        const pendentes = (vehicles ?? [])
          .map((v: any) => ({ v, oil: computeOilStatus(v) }))
          .filter(x => x.oil.status !== "ok");
        if (pendentes.length === 0) return null;
        return (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-1">
                <Wrench className="w-4 h-4" /> Trocas de óleo
              </p>
              {pendentes.map(({ v, oil }) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {formatPlaca(v.placa)} — {v.marca} {v.modelo}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      oil.status === "vencida"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}
                  >
                    {OIL_LABEL[oil.status]} ·{" "}
                    {oil.status === "vencida"
                      ? `${(-oil.kmRestante).toLocaleString("pt-BR")} km atrás`
                      : `faltam ${oil.kmRestante.toLocaleString("pt-BR")} km`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : maintenances && maintenances.length > 0 ? (
        <div className="space-y-3">
          {maintenances.map((maintenance: any) => {
            const statusInfo = getStatusBadge(maintenance.status);
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={maintenance.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate">
                        {maintenance.tipo}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getVehicleName(maintenance.veiculoId)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${statusInfo.class}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusLabel(maintenance.status)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {maintenance.descricao}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">
                        Data Prevista:
                      </span>
                      <p className="font-medium">
                        {formatDate(maintenance.dataPrevista)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Data Realizada:
                      </span>
                      <p className="font-medium">
                        {formatDate(maintenance.dataRealizada)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo:</span>
                      <p className="font-medium">
                        {formatCurrency(maintenance.custo)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openStatusDialog(maintenance)}
                  >
                    Atualizar Status
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8 text-sm">
          Nenhuma manutenção cadastrada
        </p>
      )}

      {/* Dialog para atualizar status */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status da Manutenção</DialogTitle>
            <DialogDescription>
              Atualize o status e informações da manutenção
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusFormData.status}
                onValueChange={(value: any) =>
                  setStatusFormData({ ...statusFormData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dataRealizada">
                Data de Realização
                {statusFormData.status === "concluida" ? " *" : ""}
              </Label>
              <Input
                id="dataRealizada"
                type="date"
                value={statusFormData.dataRealizada}
                onChange={e =>
                  setStatusFormData({
                    ...statusFormData,
                    dataRealizada: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="custoFinal">Custo Final (R$)</Label>
              <Input
                id="custoFinal"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={statusFormData.custo}
                onChange={e =>
                  setStatusFormData({
                    ...statusFormData,
                    custo: e.target.value,
                  })
                }
              />
            </div>
            <Button
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
              className="w-full"
            >
              {updateStatusMutation.isPending
                ? "Salvando..."
                : "Atualizar Status"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
