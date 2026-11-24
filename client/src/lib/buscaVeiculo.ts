import { formatPlaca } from "./format";

// Busca do seletor de veículo (PURA). Com dezenas de veículos, o seletor antigo
// (lista sem busca) obrigava a rolar até achar a placa — teste pré-venda
// 23/11/2026. A busca ignora acento, maiúscula e o hífen da placa ("abc1234",
// "ABC-1234" e "abc 1234" acham o mesmo veículo) e aceita várias palavras em
// qualquer ordem ("volvo 1234").
export type VeiculoOpcao = {
  id: number;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
};

const normalizar = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const soAlfanumerico = (s: string): string => s.replace(/[^a-z0-9]/g, "");

export function rotuloVeiculo(v: VeiculoOpcao): string {
  const descricao = [v.marca, v.modelo].filter(Boolean).join(" ");
  return descricao
    ? `${formatPlaca(v.placa)} — ${descricao}`
    : formatPlaca(v.placa);
}

export function filtrarVeiculos<T extends VeiculoOpcao>(
  veiculos: readonly T[],
  termo: string
): T[] {
  const palavras = normalizar(termo)
    .split(/\s+/)
    .map(soAlfanumerico)
    .filter(Boolean);
  if (palavras.length === 0) return [...veiculos];
  return veiculos.filter(v => {
    const texto = soAlfanumerico(
      normalizar(`${v.placa} ${v.marca ?? ""} ${v.modelo ?? ""}`)
    );
    return palavras.every(p => texto.includes(p));
  });
}
