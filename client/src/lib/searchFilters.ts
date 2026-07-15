// Buscas PURAS (case-insensitive, parcial) para as listagens. Vazio = passa.

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

// "contém" simples — filtra conforme o que foi digitado (não precisa do texto
// completo). Usado p/ nome de motorista, etc.
export function contemTexto(
  campo: string | null | undefined,
  termo: string
): boolean {
  const t = lower(termo);
  if (!t) return true;
  return lower(campo).includes(t);
}

// Placa: ignora hífen/espaço/pontuação dos DOIS lados (ABC-1234 == abc1234).
export function combinaPlaca(
  placa: string | null | undefined,
  termo: string
): boolean {
  const norm = (s: string | null | undefined) =>
    (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const t = norm(termo);
  if (!t) return true;
  return norm(placa).includes(t);
}
