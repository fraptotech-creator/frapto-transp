import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Check, Truck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { acaoPaywall, podeAbrirPortal } from "@/lib/billingAction";

const FEATURES = [
  "Cadastro de veículos, motoristas e viagens",
  "Manutenção e alertas de CNH/CRLV vencendo",
  "Controle financeiro (receitas e despesas)",
  "Relatórios e painel de controle",
  "Assistente de IA da sua frota",
];

/**
 * Tela de assinatura: aparece quando a empresa está logada mas SEM assinatura
 * ativa. O botão leva ao Checkout do Stripe (cartão). Após pagar, o webhook
 * libera o sistema.
 */
export default function Paywall() {
  const { user, logout } = useAuth();
  const { data: status } = trpc.billing.getStatus.useQuery();
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: e => toast.error(e.message || "Falha ao iniciar o pagamento"),
  });
  const portal = trpc.billing.createPortal.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: e =>
      toast.error(e.message || "Não foi possível abrir o gerenciamento."),
  });

  const notConfigured = status && !status.configured;
  // Cartão vencido NÃO deve abrir checkout novo — geraria uma segunda
  // assinatura enquanto a primeira segue cobrando. Regra em billingAction.ts.
  const acao = status ? acaoPaywall(status) : "assinar";
  const temPortal = status ? podeAbrirPortal(status) : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-purple-600 p-4 shadow-lg">
            <Truck className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Ative sua assinatura
          </h1>
          <p className="text-sm text-slate-400">
            Olá{user?.name ? `, ${user.name}` : ""}! Para usar o Frapto Transp,
            ative o plano da sua empresa.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="mb-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">R$ 57</span>
            <span className="text-slate-400">/mês</span>
          </div>
          <ul className="mb-6 space-y-2">
            {FEATURES.map(f => (
              <li
                key={f}
                className="flex items-start gap-2 text-sm text-slate-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>

          {notConfigured ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-center text-sm text-amber-300">
              Pagamento ainda não configurado pelo administrador do sistema.
            </p>
          ) : acao === "gerenciar" ? (
            <>
              <p className="mb-3 rounded-lg bg-amber-500/10 p-3 text-center text-sm text-amber-300">
                Não conseguimos processar o último pagamento. Atualize a forma
                de pagamento para reativar o acesso.
              </p>
              <Button
                className="w-full"
                size="lg"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {portal.isPending
                  ? "Redirecionando…"
                  : "Atualizar forma de pagamento"}
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              size="lg"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Redirecionando…" : "Assinar por R$ 57/mês"}
            </Button>
          )}

          {/* Quem já é cliente no Stripe sempre alcança o portal — inclusive
              para cancelar sem precisar falar com o suporte. */}
          {temPortal && acao !== "gerenciar" && (
            <button
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
              className="mt-3 w-full text-center text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline disabled:opacity-50"
            >
              Gerenciar assinatura ou trocar cartão
            </button>
          )}

          <p className="mt-3 text-center text-xs text-slate-500">
            Pagamento seguro via Stripe. Cancele quando quiser.
          </p>
        </div>

        <button
          onClick={() => logout()}
          className="mx-auto flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  );
}
