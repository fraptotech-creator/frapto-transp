// Normalizadores PUROS para os campos de identidade: a unicidade (e a busca)
// passa a valer pelos DÍGITOS/alfanuméricos, ignorando sinais de formatação.
// Ex.: "(27) 99919-0405" e "27999190405" viram o MESMO valor.

// Só dígitos — para CPF, CNH e telefone.
export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

// Placa: remove tudo que não é letra/número e deixa em maiúsculas.
// Ex.: "abc-1234" e "ABC 1234" → "ABC1234".
export function normalizePlaca(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
}

// Telefone opcional: normaliza; se sobrar vazio, devolve null (para não
// conflitar como string vazia no índice único — NULL múltiplo é permitido).
export function normalizeOptionalPhone(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  return digits.length > 0 ? digits : null;
}
