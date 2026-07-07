import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "signup";

/**
 * Tela de autenticação (email + senha). Cadastro cria a EMPRESA + usuário dono.
 * Ao entrar/cadastrar, invalida auth.me → o app recarrega já autenticado.
 */
export default function AuthScreen() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("login");

  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onAuthed = async () => {
    await utils.auth.me.invalidate();
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: onAuthed,
    onError: e => toast.error(e.message || "Falha ao entrar"),
  });
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: onAuthed,
    onError: e => toast.error(e.message || "Falha ao criar conta"),
  });

  const isPending = loginMutation.isPending || signupMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      signupMutation.mutate({
        orgName,
        name: name || undefined,
        email,
        password,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
            <Truck className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Frapto Transp
          </h1>
          <p className="text-sm text-slate-400">Gestão de Frotas</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-800 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md py-2 font-medium transition-colors ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-300"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md py-2 font-medium transition-colors ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-300"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Nome da empresa</Label>
                  <Input
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Ex: Transportadora Silva"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Seu nome</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-200">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={
                  mode === "signup" ? "Mínimo 8 caracteres" : "Sua senha"
                }
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
