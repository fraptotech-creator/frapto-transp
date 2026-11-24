import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  filtrarVeiculos,
  rotuloVeiculo,
  type VeiculoOpcao,
} from "@/lib/buscaVeiculo";

// Seletor de veículo COM BUSCA (placa, marca ou modelo). Substitui o <Select>
// sem busca nos formulários de viagem, manutenção e despesa. O valor é o id em
// texto ("" = nenhum), igual ao <Select> antigo, para não mudar os formulários.
// Props extras (id, aria-*) vão para o botão — assim funciona dentro do
// <FormControl> do react-hook-form.
type Props = Omit<React.ComponentProps<"button">, "value" | "onChange"> & {
  veiculos: readonly VeiculoOpcao[] | undefined;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  // Quando informado, mostra uma 1ª opção que limpa a escolha (valor "").
  rotuloNenhum?: string;
};

export default function SeletorVeiculo({
  veiculos,
  value,
  onChange,
  placeholder = "Selecione o veículo",
  rotuloNenhum,
  className,
  ...botao
}: Props) {
  const [aberto, setAberto] = React.useState(false);
  const [termo, setTermo] = React.useState("");
  const lista = veiculos ?? [];
  const selecionado = lista.find(v => String(v.id) === value);
  const filtrados = filtrarVeiculos(lista, termo);

  const escolher = (valor: string) => {
    onChange(valor);
    setAberto(false);
    setTermo("");
  };

  return (
    // modal: dentro de um Dialog, sem isto a rolagem da lista fica travada.
    <Popover open={aberto} onOpenChange={setAberto} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className={cn(
            "w-full justify-between font-normal",
            !selecionado && !rotuloNenhum && "text-muted-foreground",
            className
          )}
          {...botao}
        >
          <span className="truncate">
            {selecionado
              ? rotuloVeiculo(selecionado)
              : (rotuloNenhum ?? placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        align="start"
      >
        {/* shouldFilter=false: a busca é a nossa (sem acento/hífen), testada. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar placa, marca ou modelo…"
            value={termo}
            onValueChange={setTermo}
          />
          <CommandList>
            <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
            <CommandGroup>
              {rotuloNenhum && !termo && (
                <CommandItem value="__nenhum" onSelect={() => escolher("")}>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === "" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {rotuloNenhum}
                </CommandItem>
              )}
              {filtrados.map(v => (
                <CommandItem
                  key={v.id}
                  value={String(v.id)}
                  onSelect={() => escolher(String(v.id))}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      String(v.id) === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {rotuloVeiculo(v)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
