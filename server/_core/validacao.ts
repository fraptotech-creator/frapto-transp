// Regras de entrada compartilhadas pelos cadastros (veículo, motorista,
// viagem, manutenção, financeiro). PURAS — testadas em validacao.test.ts.
//
// Por que existe: sem `.max()` o texto longo chegava ao banco, estourava o
// tamanho da coluna e voltava como "Erro interno" (500) — ao vivo em
// 23/11/2026 (modelo de 500 caracteres, observação de 100 mil). Com o limite,
// a pessoa recebe 400 com uma mensagem que diz o que corrigir.
import { z } from "zod";

// Texto com limite = tamanho da coluna (drizzle/schema.ts).
export function texto(max: number, campo: string) {
  return z.string().max(max, `${campo}: no máximo ${max} caracteres.`);
}

// Colunas TEXT (observações, endereço, descrição): teto de uso real, bem
// abaixo dos 64 KB do TEXT.
export const TEXTO_LONGO = 2000;

// Ano de fabricação plausível: de 1950 até o ano que vem (modelo do ano
// seguinte). Ao vivo foram aceitos 1800 e 3000.
export function anoValido(ano: number, agora = new Date()): boolean {
  return Number.isInteger(ano) && ano >= 1950 && ano <= agora.getFullYear() + 1;
}

export const anoVeiculo = z
  .number()
  .refine(a => anoValido(a), "Ano do veículo inválido.");

// CPF com dígitos verificadores (ao vivo foi aceito 123.456.789-00).
// Aceita com ou sem máscara; rejeita sequências repetidas (111.111.111-11).
export function cpfValido(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    dv(d.slice(0, 9), 10) === Number(d[9]) &&
    dv(d.slice(0, 10), 11) === Number(d[10])
  );
}

// Erro de validação de entrada (zod) → a PRIMEIRA mensagem, legível. Sem isso
// o tRPC devolvia a lista de issues serializada em JSON e a tela mostrava o
// JSON cru. Duck-typing (`issues`) cobre ZodError e erros Standard Schema.
export function mensagemDeValidacao(cause: unknown): string | null {
  const issues = (cause as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  const msg = (issues[0] as { message?: unknown })?.message;
  return typeof msg === "string" && msg.trim() ? msg : null;
}

export const cpfSchema = z
  .string()
  .max(14, "CPF inválido.")
  .refine(cpfValido, "CPF inválido: confira os números.");
