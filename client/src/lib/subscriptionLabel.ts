// Tradução do status de assinatura (Stripe) para o painel da plataforma.
// Funções puras — testadas em subscriptionLabel.test.ts.

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function rotuloAssinatura(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Ativa";
    case "trialing":
      return "Em teste";
    case "past_due":
      return "Pagamento atrasado";
    case "canceled":
      return "Cancelada";
    case "incomplete":
    case "incomplete_expired":
      return "Incompleta";
    case "unpaid":
      return "Não paga";
    default:
      return "Sem assinatura";
  }
}

export function corAssinatura(status: string | null | undefined): BadgeVariant {
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid") return "destructive";
  return "secondary";
}
