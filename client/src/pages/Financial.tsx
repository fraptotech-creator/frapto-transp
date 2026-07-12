import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { showErrorDialog } from "@/lib/errorDialog";
import { formatPlaca } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ExpenseTipo =
  | "combustivel"
  | "manutencao"
  | "pedagio"
  | "seguro"
  | "salario"
  | "outros";

type RevenueTipo = "viagem" | "frete" | "servico" | "outros";
type RevenueStatus = "pendente" | "recebido" | "cancelado";

const emptyExpense = {
  tipo: "combustivel" as ExpenseTipo,
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  veiculoId: "", // vazio = despesa geral (sem veículo)
  categoria: "",
  formaPagamento: "",
  observacoes: "",
};

const emptyRevenue = {
  tipo: "viagem" as RevenueTipo,
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  clienteNome: "",
  clienteCpfCnpj: "",
  formaPagamento: "",
  status: "pendente" as RevenueStatus,
  observacoes: "",
};

export default function Financial() {
  const {
    data: fin,
    isLoading,
    refetch: refetchFin,
  } = trpc.dashboard.financeSummary.useQuery();
  const { data: vehicles } = trpc.vehicles.list.useQuery();

  const createExpenseMutation = trpc.expenses.create.useMutation();
  const createRevenueMutation = trpc.revenues.create.useMutation();
  const deleteExpenseMutation = trpc.expenses.delete.useMutation();
  const deleteRevenueMutation = trpc.revenues.delete.useMutation();

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);

  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [revenueForm, setRevenueForm] = useState(emptyRevenue);

  // Filtro de data (yyyy-mm-dd) — aplicado às listas e aos totais.
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const handleCreateExpense = async () => {
    if (!expenseForm.descricao || !expenseForm.valor || !expenseForm.data) {
      toast.error("Preencha descrição, valor e data.");
      return;
    }
    try {
      await createExpenseMutation.mutateAsync({
        tipo: expenseForm.tipo,
        descricao: expenseForm.descricao,
        valor: expenseForm.valor,
        data: new Date(expenseForm.data),
        veiculoId: expenseForm.veiculoId
          ? parseInt(expenseForm.veiculoId, 10)
          : undefined,
        categoria: expenseForm.categoria || undefined,
        formaPagamento: expenseForm.formaPagamento || undefined,
        observacoes: expenseForm.observacoes || undefined,
      });
      toast.success("Despesa criada com sucesso!");
      setExpenseDialogOpen(false);
      setExpenseForm(emptyExpense);
      refetchFin();
    } catch (error: any) {
      showErrorDialog(error?.message || "Erro ao criar despesa", "Erro");
    }
  };

  const handleCreateRevenue = async () => {
    if (!revenueForm.descricao || !revenueForm.valor || !revenueForm.data) {
      toast.error("Preencha descrição, valor e data.");
      return;
    }
    try {
      await createRevenueMutation.mutateAsync({
        tipo: revenueForm.tipo,
        descricao: revenueForm.descricao,
        valor: revenueForm.valor,
        data: new Date(revenueForm.data),
        clienteNome: revenueForm.clienteNome || undefined,
        clienteCpfCnpj: revenueForm.clienteCpfCnpj || undefined,
        formaPagamento: revenueForm.formaPagamento || undefined,
        status: revenueForm.status,
        observacoes: revenueForm.observacoes || undefined,
      });
      toast.success("Receita criada com sucesso!");
      setRevenueDialogOpen(false);
      setRevenueForm(emptyRevenue);
      refetchFin();
    } catch (error: any) {
      showErrorDialog(error?.message || "Erro ao criar receita", "Erro");
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
    try {
      await deleteExpenseMutation.mutateAsync({ id });
      toast.success("Despesa excluída com sucesso!");
      refetchFin();
    } catch (error: any) {
      showErrorDialog(error?.message || "Erro ao excluir despesa", "Erro");
    }
  };

  const handleDeleteRevenue = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    try {
      await deleteRevenueMutation.mutateAsync({ id });
      toast.success("Receita excluída com sucesso!");
      refetchFin();
    } catch (error: any) {
      showErrorDialog(error?.message || "Erro ao excluir receita", "Erro");
    }
  };

  // Extrato itemizado consolidado (viagens + manutenções + lançamentos manuais),
  // filtrado por data. Os totais dos cards acompanham o filtro.
  const inRange = (iso: string) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    if (dataDe && d < dataDe) return false;
    if (dataAte && d > dataAte) return false;
    return true;
  };
  const ledger = (fin?.ledger ?? []).filter(e => inRange(e.data));
  const receitaItems = ledger.filter(e => e.kind === "receita");
  const despesaItems = ledger.filter(e => e.kind === "despesa");

  const totalRevenues = receitaItems
    .filter(e => e.realizado)
    .reduce((s, e) => s + e.valor, 0);
  const revenuesPending = receitaItems
    .filter(e => !e.realizado)
    .reduce((s, e) => s + e.valor, 0);
  const totalExpenses = despesaItems.reduce((s, e) => s + e.valor, 0);
  const balance = totalRevenues - totalExpenses;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Gestão Financeira</h1>
        <p className="text-sm text-muted-foreground">
          Controle de receitas e despesas
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: "Receitas",
            value: totalRevenues,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
          },
          {
            title: "Despesas",
            value: totalExpenses,
            icon: TrendingDown,
            color: "text-rose-600",
            bg: "bg-rose-500/10",
          },
          {
            title: "Saldo",
            value: balance,
            icon: DollarSign,
            color: balance >= 0 ? "text-indigo-600" : "text-rose-600",
            bg: balance >= 0 ? "bg-indigo-500/10" : "bg-rose-500/10",
          },
          {
            title: "A Receber",
            value: revenuesPending,
            icon: Calendar,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
          },
        ].map((card, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className={`p-3 w-fit rounded-2xl ${card.bg} ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>
                  R${" "}
                  {card.value.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtro de data */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={dataDe}
            onChange={e => setDataDe(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={dataAte}
            onChange={e => setDataAte(e.target.value)}
            className="w-[160px]"
          />
        </div>
        {(dataDe || dataAte) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDataDe("");
              setDataAte("");
            }}
          >
            Limpar filtro
          </Button>
        )}
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
        </TabsList>

        {/* Despesas */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Lista de Despesas</h2>
            <Dialog
              open={expenseDialogOpen}
              onOpenChange={o => {
                setExpenseDialogOpen(o);
                if (o) setExpenseForm(emptyExpense);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Despesa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select
                      value={expenseForm.tipo}
                      onValueChange={(v: any) =>
                        setExpenseForm({ ...expenseForm, tipo: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="combustivel">Combustível</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="pedagio">Pedágio</SelectItem>
                        <SelectItem value="seguro">Seguro</SelectItem>
                        <SelectItem value="salario">Salário</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Veículo (opcional)</Label>
                    <Select
                      value={expenseForm.veiculoId || "none"}
                      onValueChange={v =>
                        setExpenseForm({
                          ...expenseForm,
                          veiculoId: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Despesa geral (sem veículo)
                        </SelectItem>
                        {vehicles?.map((v: any) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {formatPlaca(v.placa)} — {v.marca} {v.modelo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Descrição *</Label>
                    <Input
                      placeholder="Ex: Abastecimento posto X"
                      value={expenseForm.descricao}
                      onChange={e =>
                        setExpenseForm({
                          ...expenseForm,
                          descricao: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={expenseForm.valor}
                        onChange={e =>
                          setExpenseForm({
                            ...expenseForm,
                            valor: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={expenseForm.data}
                        onChange={e =>
                          setExpenseForm({
                            ...expenseForm,
                            data: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Input
                        placeholder="Opcional"
                        value={expenseForm.categoria}
                        onChange={e =>
                          setExpenseForm({
                            ...expenseForm,
                            categoria: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Input
                        placeholder="Ex: Cartão, PIX, Dinheiro"
                        value={expenseForm.formaPagamento}
                        onChange={e =>
                          setExpenseForm({
                            ...expenseForm,
                            formaPagamento: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      rows={2}
                      placeholder="Informações adicionais"
                      value={expenseForm.observacoes}
                      onChange={e =>
                        setExpenseForm({
                          ...expenseForm,
                          observacoes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleCreateExpense}
                    disabled={createExpenseMutation.isPending}
                    className="w-full"
                  >
                    {createExpenseMutation.isPending
                      ? "Salvando..."
                      : "Salvar Despesa"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesaItems.length > 0 ? (
                despesaItems.map(item => (
                  <TableRow key={`${item.origem}-${item.refId}`}>
                    <TableCell>
                      {new Date(item.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="capitalize">
                      {item.categoria}
                    </TableCell>
                    <TableCell>
                      {item.descricao}
                      {item.veiculo && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · 🚛 {item.veiculo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-rose-600 font-medium">
                      R${" "}
                      {item.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {item.editable ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(item.refId)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          via Manutenção
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-6"
                  >
                    Nenhuma despesa no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Receitas */}
        <TabsContent value="revenues" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Lista de Receitas</h2>
            <Dialog
              open={revenueDialogOpen}
              onOpenChange={o => {
                setRevenueDialogOpen(o);
                if (o) setRevenueForm(emptyRevenue);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Receita</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo *</Label>
                      <Select
                        value={revenueForm.tipo}
                        onValueChange={(v: any) =>
                          setRevenueForm({ ...revenueForm, tipo: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viagem">Viagem</SelectItem>
                          <SelectItem value="frete">Frete</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status *</Label>
                      <Select
                        value={revenueForm.status}
                        onValueChange={(v: any) =>
                          setRevenueForm({ ...revenueForm, status: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="recebido">Recebido</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Descrição *</Label>
                    <Input
                      placeholder="Ex: Frete São Paulo - Rio"
                      value={revenueForm.descricao}
                      onChange={e =>
                        setRevenueForm({
                          ...revenueForm,
                          descricao: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={revenueForm.valor}
                        onChange={e =>
                          setRevenueForm({
                            ...revenueForm,
                            valor: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={revenueForm.data}
                        onChange={e =>
                          setRevenueForm({
                            ...revenueForm,
                            data: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cliente</Label>
                      <Input
                        placeholder="Nome"
                        value={revenueForm.clienteNome}
                        onChange={e =>
                          setRevenueForm({
                            ...revenueForm,
                            clienteNome: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>CPF/CNPJ</Label>
                      <Input
                        placeholder="Opcional"
                        value={revenueForm.clienteCpfCnpj}
                        onChange={e =>
                          setRevenueForm({
                            ...revenueForm,
                            clienteCpfCnpj: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Input
                      placeholder="Ex: Boleto, PIX, Transferência"
                      value={revenueForm.formaPagamento}
                      onChange={e =>
                        setRevenueForm({
                          ...revenueForm,
                          formaPagamento: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      rows={2}
                      placeholder="Informações adicionais"
                      value={revenueForm.observacoes}
                      onChange={e =>
                        setRevenueForm({
                          ...revenueForm,
                          observacoes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleCreateRevenue}
                    disabled={createRevenueMutation.isPending}
                    className="w-full"
                  >
                    {createRevenueMutation.isPending
                      ? "Salvando..."
                      : "Salvar Receita"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receitaItems.length > 0 ? (
                receitaItems.map(item => (
                  <TableRow key={`${item.origem}-${item.refId}`}>
                    <TableCell>
                      {new Date(item.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="capitalize">
                      {item.categoria}
                    </TableCell>
                    <TableCell>
                      {item.descricao}
                      {item.veiculo && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · 🚛 {item.veiculo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      R${" "}
                      {item.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          item.realizado
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.editable ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRevenue(item.refId)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          via Viagens
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-6"
                  >
                    Nenhuma receita no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
