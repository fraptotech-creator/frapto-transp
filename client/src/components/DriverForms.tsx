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
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";
import { formatCpf, formatPhone } from "@/lib/format";
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

const driverSchema = z.object({
  nome: z.string().min(1, "O nome é obrigatório."),
  cpf: z.string().min(11, "CPF inválido.").max(14, "CPF inválido."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  telefone: z.string().optional(),
  cnh: z.string().min(1, "A CNH é obrigatória."),
  cnhCategoria: z.string().min(1, "A categoria é obrigatória."),
  cnhVencimento: z.string().min(1, "O vencimento da CNH é obrigatório."),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
});

type DriverFormValues = z.infer<typeof driverSchema>;

interface DriverFormProps {
  driver?: any;
  onSuccess: () => void;
}

const DriverForm: React.FC<DriverFormProps> = ({ driver, onSuccess }) => {
  const queryClient = useQueryClient();
  const isEdit = !!driver;

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      nome: driver?.nome || "",
      cpf: formatCpf(driver?.cpf),
      email: driver?.email || "",
      telefone: formatPhone(driver?.telefone),
      cnh: driver?.cnh || "",
      cnhCategoria: driver?.cnhCategoria || "",
      cnhVencimento: driver?.cnhVencimento
        ? new Date(driver.cnhVencimento).toISOString().split("T")[0]
        : "",
      endereco: driver?.endereco || "",
      observacoes: driver?.observacoes || "",
    },
  });

  const createMutation = trpc.drivers.create.useMutation({
    onSuccess: () => {
      toast.success("Motorista cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["drivers", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao cadastrar motorista");
    },
  });

  const updateMutation = trpc.drivers.update.useMutation({
    onSuccess: () => {
      toast.success("Motorista atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["drivers", "list"]] });
      onSuccess();
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao atualizar motorista");
    },
  });

  const onSubmit = (values: DriverFormValues) => {
    const dataToSubmit = {
      ...values,
      cnhVencimento: new Date(values.cnhVencimento),
      email: values.email || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: driver.id, ...dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="João da Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input placeholder="000.000.000-00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(99) 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input placeholder="joao@empresa.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="cnh"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CNH</FormLabel>
                <FormControl>
                  <Input placeholder="00000000000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cnhCategoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria CNH</FormLabel>
                <FormControl>
                  <Input placeholder="D ou E" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cnhVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento CNH</FormLabel>
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
          name="endereco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endereço</FormLabel>
              <FormControl>
                <Input placeholder="Rua, Número, Bairro, Cidade" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Informações adicionais sobre o motorista"
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
          {isEdit ? "Salvar Alterações" : "Cadastrar Motorista"}
        </Button>
      </form>
    </Form>
  );
};

const DeleteDriverDialog: React.FC<{ driverId: number }> = ({ driverId }) => {
  const queryClient = useQueryClient();
  const deleteMutation = trpc.drivers.delete.useMutation({
    onSuccess: () => {
      toast.success("Motorista excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: [["drivers", "list"]] });
    },
    onError: (error: any) => {
      showErrorDialog(error.message, "Erro ao excluir motorista");
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: driverId });
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
            motorista e todos os dados relacionados.
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

export const DriverDialog: React.FC<{ driver?: any }> = ({ driver }) => {
  const [open, setOpen] = React.useState(false);
  const isEdit = !!driver;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>Cadastrar Novo Motorista</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Motorista" : "Cadastrar Novo Motorista"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Faça as alterações necessárias no cadastro do motorista."
              : "Preencha os campos para cadastrar um novo motorista."}
          </DialogDescription>
        </DialogHeader>
        <DriverForm driver={driver} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export const DriverActions: React.FC<{ driver: any }> = ({ driver }) => {
  return (
    <div className="flex space-x-2">
      <DriverDialog driver={driver} />
      <DeleteDriverDialog driverId={driver.id} />
    </div>
  );
};
