import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Página PÚBLICA: quem chega aqui não consegue logar, então não pode exigir
// sessão. O token da URL é a credencial.
export default function RedefinirSenha() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  // Para onde levar após criar a senha. O motorista chega com ?next=/motorista
  // e deve cair no app dele, não na tela de e-mail. Só aceitamos caminho
  // interno (começa com "/") — nunca uma URL externa vinda da querystring.
  const nextParam = params.get("next") ?? "";
  const next = nextParam.startsWith("/") ? nextParam : "/";
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [pronto, setPronto] = useState(false);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setPronto(true),
    onError: e => toast.error(e.message),
  });

  const senhaCurta = senha.length > 0 && senha.length < 8;
  const naoConfere = confirma.length > 0 && senha !== confirma;
  const podeEnviar =
    senha.length >= 8 && senha === confirma && token && !reset.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-purple-600 p-4 shadow-lg">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">
            {pronto ? "Senha alterada" : "Criar nova senha"}
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          {!token ? (
            <p className="text-center text-sm text-amber-300">
              Link incompleto. Abra o link exatamente como recebeu.
            </p>
          ) : pronto ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="text-sm text-slate-300">
                Sua senha foi alterada. Por segurança, as sessões abertas em
                outros aparelhos foram encerradas.
              </p>
              <Button
                className="w-full"
                onClick={() => (window.location.href = next)}
              >
                Entrar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nova senha</Label>
                <Input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                />
                {senhaCurta && (
                  <p className="text-xs text-amber-400">
                    Use ao menos 8 caracteres.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Repita a senha</Label>
                <Input
                  type="password"
                  value={confirma}
                  onChange={e => setConfirma(e.target.value)}
                  autoComplete="new-password"
                />
                {naoConfere && (
                  <p className="text-xs text-amber-400">
                    As senhas não são iguais.
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!podeEnviar}
                onClick={() => reset.mutate({ token, password: senha })}
              >
                {reset.isPending ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Este link é de uso único e tem validade limitada.
        </p>
      </div>
    </div>
  );
}
