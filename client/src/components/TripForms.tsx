import React, { useEffect, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Edit, MapPin, Navigation } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const tripSchema = z.object({
  numeroViagem: z.string().min(1, "O número da viagem é obrigatório."),
  veiculoId: z.string().min(1, "O veículo é obrigatório."),
  motoristaId: z.string().min(1, "O motorista é obrigatório."),
  origem: z.string().min(1, "A origem é obrigatória."),
  destino: z.string().min(1, "O destino é obrigatório."),
  dataPartida: z.string().min(1, "A data de partida é obrigatória."),
  status: z.enum(["planejada", "em_andamento", "concluida", "cancelada"]),
  distancia: z.string().optional(),
  carga: z.string().optional(),
  pesoTotal: z.string().optional(),
  valor: z.string().optional(),
  observacoes: z.string().optional(),
});

type TripFormValues = z.infer<typeof tripSchema>;

interface TripFormProps {
  trip?: any;
  onSuccess: () => void;
}

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
  const isEdit = !!trip;
  const originInputRef = useRef<HTMLInputElement | null>(null);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);

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
      dataPartida: trip?.dataPartida ? new Date(trip.dataPartida).toISOString().split("T")[0] : "",
      status: trip?.status || "planejada",
      distancia: trip?.distancia?.toString() || "",
      carga: trip?.carga || "",
      pesoTotal: trip?.pesoTotal?.toString() || "",
      valor: trip?.valor?.toString() || "",
      observacoes: trip?.observacoes || "",
    },
  });

  // Integrar Google Places Autocomplete (se disponível)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const g = (window as any).google;
    if (!g || !g.maps || !g.maps.places) return;

    const options = {
      types: ["(cities)"],
      componentRestrictions: { country: "br" },
    };

    if (originInputRef.current) {
      const autocompleteOrigin = new g.maps.places.Autocomplete(originInputRef.current, options);
      autocompleteOrigin.addListener("place_changed", () => {
        const place = autocompleteOrigin.getPlace();
        if (place?.formatted_address) {
          form.setValue("origem", place.formatted_address);
          calculateDistance();
        }
      });
    }

    if (destinationInputRef.current) {
      const autocompleteDest = new g.maps.places.Autocomplete(destinationInputRef.current, options);
      autocompleteDest.addListener("place_changed", () => {
        const place = autocompleteDest.getPlace();
        if (place?.formatted_address) {
          form.setValue("destino", place.formatted_address);
          calculateDistance();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateDistance = () => {
    const origin = form.getValues("origem");
    const destination = form.getValues("destino");
    const g = (window as any).google;

    if (origin && destination && g && g.maps) {
      const service = new g.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: g.maps.TravelMode.DRIVING,
        },
        (response: any, status: any) => {
          if (status === "OK" && response && response.rows[0].elements[0].status === "OK") {
            const distanceKm = response.rows[0].elements[0].distance.value / 1000;
            form.setValue("distancia", distanceKm.toFixed(2));
            toast.info(`Distância calculada: ${distanceKm.toFixed(2)} km`);
          }
        }
      );
    }
  };

  const createMutation = trpc.trips.create.useMutation({
    onSuccess: () => {
      toast.success("Viagem cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["trips", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar viagem: " + error.message);
    },
  });

  const updateMutation = trpc.trips.update.useMutation({
    onSuccess: () => {
      toast.success("Viagem atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["trips", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar viagem: " + error.message);
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
        status: values.status,
        distancia: values.distancia || undefined,
        carga: values.carga || undefined,
        pesoTotal: values.pesoTotal || undefined,
        valor: values.valor || undefined,
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
        distancia: values.distancia || undefined,
        carga: values.carga || undefined,
        pesoTotal: values.pesoTotal || undefined,
        valor: values.valor || undefined,
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
                        {v.placa} - {v.modelo}
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
                    <Input
                      placeholder="Cidade de origem"
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        originInputRef.current = el;
                      }}
                    />
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
                    <Input
                      placeholder="Cidade de destino"
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        destinationInputRef.current = el;
                      }}
                    />
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
                <FormLabel>Data de Partida</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                <FormLabel>Distância (km)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
                <Textarea placeholder="Informações adicionais sobre a viagem" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
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
      toast.error("Erro ao excluir viagem: " + error.message);
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
            Esta ação não pode ser desfeita. Isso excluirá permanentemente a viagem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
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
          <Button className="bg-purple-600 hover:bg-purple-700">Cadastrar Nova Viagem</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Viagem" : "Cadastrar Nova Viagem"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Faça as alterações necessárias na viagem." : "Preencha os campos para cadastrar uma nova viagem."}
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
