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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";
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

const vehicleSchema = z.object({
  placa: z.string().min(1, "A placa é obrigatória."),
  marca: z.string().min(1, "A marca é obrigatória."),
  modelo: z.string().min(1, "O modelo é obrigatório."),
  ano: z
    .number()
    .min(1900, "Ano inválido.")
    .max(new Date().getFullYear(), "Ano inválido."),
  tipo: z.enum(["caminhao", "van", "onibus", "carro"]),
  capacidadeCarga: z.string().optional(),
  crlvVencimento: z.string().optional(),
  seguroVencimento: z.string().optional(),
  observacoes: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  vehicle?: any;
  onSuccess: () => void;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onSuccess }) => {
  const queryClient = useQueryClient();
  const isEdit = !!vehicle;

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      placa: vehicle?.placa || "",
      marca: vehicle?.marca || "",
      modelo: vehicle?.modelo || "",
      ano: vehicle?.ano || new Date().getFullYear(),
      tipo: vehicle?.tipo || "caminhao",
      capacidadeCarga: vehicle?.capacidadeCarga?.toString() || "",
      crlvVencimento: vehicle?.crlvVencimento
        ? new Date(vehicle.crlvVencimento).toISOString().split("T")[0]
        : "",
      seguroVencimento: vehicle?.seguroVencimento
        ? new Date(vehicle.seguroVencimento).toISOString().split("T")[0]
        : "",
      observacoes: vehicle?.observacoes || "",
    },
  });

  const createMutation = trpc.vehicles.create.useMutation({
    onSuccess: () => {
      toast.success("Veículo cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["vehicles", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar veículo: " + error.message);
    },
  });

  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: () => {
      toast.success("Veículo atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["vehicles", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar veículo: " + error.message);
    },
  });

  const onSubmit = (values: VehicleFormValues) => {
    const dataToSubmit = {
      ...values,
      crlvVencimento: values.crlvVencimento
        ? new Date(values.crlvVencimento)
        : undefined,
      seguroVencimento: values.seguroVencimento
        ? new Date(values.seguroVencimento)
        : undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: vehicle.id, ...dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="placa"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Placa</FormLabel>
              <FormControl>
                <Input placeholder="ABC-1234" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="marca"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca</FormLabel>
                <FormControl>
                  <Input placeholder="Mercedes-Benz" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="modelo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo</FormLabel>
                <FormControl>
                  <Input placeholder="Axor 2544" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ano"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2020"
                    {...field}
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="caminhao">Caminhão</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="onibus">Ônibus</SelectItem>
                    <SelectItem value="carro">Carro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="capacidadeCarga"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacidade de Carga (kg)</FormLabel>
                <FormControl>
                  <Input placeholder="10000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="crlvVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento CRLV</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="seguroVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento Seguro</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
                  placeholder="Informações adicionais sobre o veículo"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {isEdit ? "Salvar Alterações" : "Cadastrar Veículo"}
        </Button>
      </form>
    </Form>
  );
};

const DeleteVehicleDialog: React.FC<{ vehicleId: number }> = ({
  vehicleId,
}) => {
  const queryClient = useQueryClient();
  const deleteMutation = trpc.vehicles.delete.useMutation({
    onSuccess: () => {
      toast.success("Veículo excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["vehicles", "list"]] });
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir veículo: " + error.message);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: vehicleId });
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
            Esta ação não pode ser desfeita. Isso excluirá permanentemente o
            veículo e todos os dados relacionados.
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

export const VehicleDialog: React.FC<{ vehicle?: any }> = ({ vehicle }) => {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!vehicle;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>Cadastrar Novo Veículo</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Veículo" : "Cadastrar Novo Veículo"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Faça as alterações necessárias no cadastro do veículo."
              : "Preencha os campos para cadastrar um novo veículo na frota."}
          </DialogDescription>
        </DialogHeader>
        <VehicleForm vehicle={vehicle} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export const VehicleActions: React.FC<{ vehicle: any }> = ({ vehicle }) => {
  return (
    <div className="flex space-x-2">
      <VehicleDialog vehicle={vehicle} />
      <DeleteVehicleDialog vehicleId={vehicle.id} />
    </div>
  );
};
