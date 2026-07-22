import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { rotuloAssinatura, corAssinatura } from "@/lib/subscriptionLabel";
import { podeAbrirPortal } from "@/lib/billingAction";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString("pt-BR");
}

// Assinatura: leva ao Portal do Cliente da Stripe, onde o próprio assinante
// troca o cartão, vê faturas e cancela — sem precisar falar com o suporte.
export default function AssinaturaCard() {
  const { data } = trpc.billing.getStatus.useQuery();
  const portal = trpc.billing.createPortal.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: e =>
      toast.error(e.message || "Não foi possível abrir o gerenciamento."),
  });

  if (!data) return null;

  const renovaEm = formatDate(data.currentPeriodEnd);
  const podeGerenciar = podeAbrirPortal(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Assinatura
        </CardTitle>
        <CardDescription>
          Plano, forma de pagamento e cancelamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Badge variant={corAssinatura(data.status)}>
            {rotuloAssinatura(data.status)}
          </Badge>
          <span className="text-muted-foreground">{data.priceLabel}</span>
          {renovaEm && (
            <span className="text-muted-foreground">
              {data.active ? "Renova em" : "Válido até"} {renovaEm}
            </span>
          )}
        </div>

        {podeGerenciar ? (
          <>
            <Button
              variant="outline"
              disabled={portal.isPending}
              onClick={() => portal.mutate()}
            >
              {portal.isPending ? "Abrindo…" : "Gerenciar assinatura"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Abre o portal seguro da Stripe, onde você troca o cartão, baixa as
              faturas ou cancela o plano.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma cobrança ativa nesta empresa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
