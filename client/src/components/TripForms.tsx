import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";
import { formatPlaca } from "@/lib/format";
import { Trash2, Edit, MapPin, Navigation } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const tripSchema = z.object({
  numeroViagem: z.string().min(1, "O número da viagem é obrigatório."),
  veiculoId: z.string().min(1, "O veículo é obrigatório."),
  motoristaId: z.string().min(1, "O motorista é obrigatório."),
  origem: z.string().min(1, "A origem é obrigatória."),
  destino: z.string().min(1, "O destino é obrigatório."),
  dataPartida: z.string().min(1, "A data de partida é obrigatória."),
  previsaoChegada: z.string().optional(),
  status: z.enum(["planejada", "em_andamento", "concluida", "cancelada"]),
  distancia: z.string().optional(),
  carga: z.string().optional(),
  pesoTotal: z.string().optional(),
  valor: z.string().optional(),
  pago: z.boolean().optional(),
  observacoes: z.string().optional(),
});

type TripFormValues = z.infer<typeof tripSchema>;

interface TripFormProps {
  trip?: any;
  onSuccess: () => void;
}

// Formata uma data para o input datetime-local (yyyy-MM-ddTHH:mm) em hora LOCAL.
const toLocalInput = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

// Gera um número de viagem padrão sugerido (ex.: V-20260427-123)
const suggestTripNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `V-${yyyy}${mm}${dd}-${rand}`;
};

const TripForm: React.FC<TripFormProps> = ({ trip, onSuccess }) => {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const isEdit = !!trip;

  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const { data: drivers } = trpc.drivers.list.useQuery();

  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      numeroViagem: trip?.numeroViagem || suggestTripNumber(),
      veiculoId: trip?.veiculoId?.toString() || "",
      motoristaId: trip?.motoristaId?.toString() || "",
      origem: trip?.origem || "",
      destino: trip?.destino || "",
      dataPartida: toLocalInput(trip?.dataPartida),
      previsaoChegada: toLocalInput(trip?.previsaoChegada),
      status: trip?.status || "planejada",
      distancia: trip?.distancia?.toString() || "",
      carga: trip?.carga || "",
      pesoTotal: trip?.pesoTotal?.toString() || "",
      valor: trip?.valor?.toString() || "",
      pago: trip?.pago ?? false,
      observacoes: trip?.observacoes || "",
    },
  });

  // Calcula a distância pela rota real (OpenStreetMap/OSRM) e preenche o campo.
  const [calculando, setCalculando] = React.useState(false);
  const calcularDistancia = async () => {
    const origem = form.getValues("origem");
    const destino = form.getValues("destino");
    if (!origem || !destino) {
      toast.error("Preencha origem e destino primeiro.");
      return;
    }
    setCalculando(true);
    try {
      const r = await utils.geo.route.fetch({ origem, destino });
      if (r.ok) {
        form.setValue("distancia", String(r.distanceKm));
        toast.success(`Distância: ${r.distanceKm} km (~${r.durationMin} min)`);
      } else {
        toast.error(
          "Não foi possível calcular pela rota. Confira os endereços."
        );
      }
    } catch {
      toast.error("Falha ao calcular a distância.");
    } finally {
      setCalculando(false);
    }
  };

  const createMutation = trpc.trips.create.useMutation({
    onSuccess: () => {
      toast.success("Viagem cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["trips", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao cadastrar viagem");
    },
  });

  const updateMutation = trpc.trips.update.useMutation({
    onSuccess: () => {
      toast.success("Viagem atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["trips", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao atualizar viagem");
    },
  });

  const onSubmit = (values: TripFormValues) => {
    if (isEdit) {
      const updatePayload: any = {
        id: trip.id,
        numeroViagem: values.numeroViagem,
        veiculoId: parseInt(values.veiculoId),
        motoristaId: parseInt(values.motoristaId),
        origem: values.origem,
        destino: values.destino,
        dataPartida: new Date(values.dataPartida),
        previsaoChegada: values.previsaoChegada
          ? new Date(values.previsaoChegada)
          : undefined,
        status: values.status,
        distancia: values.distancia || undefined,
        carga: values.carga || undefined,
        pesoTotal: values.pesoTotal || undefined,
        valor: values.valor || undefined,
        pago: values.pago,
        observacoes: values.observacoes || undefined,
      };
      updateMutation.mutate(updatePayload);
    } else {
      const createPayload: any = {
        numeroViagem: values.numeroViagem,
        veiculoId: parseInt(values.veiculoId),
        motoristaId: parseInt(values.motoristaId),
        origem: values.origem,
        destino: values.destino,
        dataPartida: new Date(values.dataPartida),
        previsaoChegada: values.previsaoChegada
          ? new Date(values.previsaoChegada)
          : undefined,
        distancia: values.distancia || undefined,
        carga: values.carga || undefined,
        pesoTotal: values.pesoTotal || undefined,
        valor: values.valor || undefined,
        pago: values.pago,
        observacoes: values.observacoes || undefined,
      };
      createMutation.mutate(createPayload);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="numeroViagem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número da Viagem</FormLabel>
              <FormControl>
                <Input placeholder="V-20260427-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="veiculoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Veículo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicles?.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {formatPlaca(v.placa)} - {v.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motoristaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motorista</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motorista" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {drivers?.map((d: any) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Navigation className="w-4 h-4" />
            Definição de Rota
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="origem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-500" /> Origem
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Cidade de origem" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destino"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-500" /> Destino
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Cidade de destino" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dataPartida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data e Hora de Partida</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="previsaoChegada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Previsão de Chegada (cliente)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="planejada">Planejada</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="distancia"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Distância (km)</span>
                  <button
                    type="button"
                    onClick={calcularDistancia}
                    disabled={calculando}
                    className="text-xs text-blue-500 hover:underline disabled:opacity-50"
                  >
                    {calculando ? "Calculando…" : "Calcular pela rota"}
                  </button>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor do Frete (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="pago"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5 pr-3">
                <FormLabel>Pagamento recebido</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Independe do status — marque quando o cliente pagar (antes ou
                  depois de concluir a viagem).
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="carga"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carga</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Eletrônicos, Grãos" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pesoTotal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Peso Total (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Informações adicionais sobre a viagem"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full h-12 text-lg font-bold"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {isEdit ? "Salvar Alterações" : "Confirmar e Cadastrar Viagem"}
        </Button>
      </form>
    </Form>
  );
};

const DeleteTripDialog: React.FC<{ tripId: number }> = ({ tripId }) => {
  const queryClient = useQueryClient();
  const deleteMutation = trpc.trips.delete.useMutation({
    onSuccess: () => {
      toast.success("Viagem excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["trips", "list"]] });
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao excluir viagem");
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: tripId });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" className="h-8 w-8">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Isso excluirá permanentemente a
            viagem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const TripDialog: React.FC<{ trip?: any }> = ({ trip }) => {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!trip;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-purple-600 hover:bg-purple-700">
            Cadastrar Nova Viagem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Viagem" : "Cadastrar Nova Viagem"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Faça as alterações necessárias na viagem."
              : "Preencha os campos para cadastrar uma nova viagem."}
          </DialogDescription>
        </DialogHeader>
        <TripForm trip={trip} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export const TripActions: React.FC<{ trip: any }> = ({ trip }) => {
  return (
    <div className="flex space-x-2">
      <TripDialog trip={trip} />
      <DeleteTripDialog tripId={trip.id} />
    </div>
  );
};
