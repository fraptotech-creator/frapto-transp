// Máscara de PII para LOGS (best-effort, fail-safe: prefere mascarar demais a de
// menos). Redige e-mails e sequências longas de dígitos (telefone/CPF/CNH). Não
// substitui o toSafeLogError (que trata objetos de erro) — este é para strings
// livres que vão ao log (ex.: conteúdo de notificação, mensagens de admin).
export function maskPii(s: string): string {
  if (!s) return s;
  return (
    s
      // e-mails
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, "«email»")
      // sequências com 8+ dígitos (telefone/CPF/CNH), com separadores comuns
      .replace(/\d[\d.\-/() ]{6,}\d/g, m =>
        m.replace(/\D/g, "").length >= 8 ? "«num»" : m
      )
  );
}
