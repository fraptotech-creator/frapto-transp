// Formatação de EXIBIÇÃO. Os valores são guardados normalizados (só dígitos /
// alfanumérico); aqui remontamos a máscara "bonitinha" para mostrar na tela.
// Se o valor não bate o formato esperado, devolve o original (nunca quebra).

const digits = (v: string) => v.replace(/\D+/g, "");

// CPF: 08502274708 → 085.022.747-08
export function formatCpf(value: string | null | undefined): string {
  if (!value) return "";
  const d = digits(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Telefone BR: 27999190405 → (27) 99919-0405 | 1133334444 → (11) 3333-4444
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const d = digits(value);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return value;
}

// Placa: ABC1234 → ABC-1234 (padrão antigo). Mercosul (ABC1D23) fica sem hífen.
export function formatPlaca(value: string | null | undefined): string {
  if (!value) return "";
  const s = value.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
  if (/^[A-Z]{3}[0-9]{4}$/.test(s)) {
    return `${s.slice(0, 3)}-${s.slice(3)}`;
  }
  return s;
}
