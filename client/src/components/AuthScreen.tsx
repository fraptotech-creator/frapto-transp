import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import EsqueciSenhaDialog from "@/components/EsqueciSenhaDialog";
import { toast } from "sonner";

// Mensagens amigáveis para o ?error= que o callback do Google usa ao falhar.
const GOOGLE_ERROS: Record<string, string> = {
  google_indisponivel: "Login com Google indisponível no momento.",
  google_state: "A sessão de login expirou. Tente novamente.",
  no_email: "O Google não liberou um e-mail verificado.",
  google_driver: "Esta conta é de motorista — entre pelo app do motorista.",
  missing_code: "Não foi possível entrar com o Google. Tente de novo.",
  auth_failed: "Não foi possível entrar com o Google. Tente de novo.",
};

type Mode = "login" | "signup";

/**
 * Tela de autenticação (email + senha). Cadastro cria a EMPRESA + usuário dono.
 * Ao entrar/cadastrar, invalida auth.me → o app recarrega já autenticado.
 */
export default function AuthScreen({
  initialMode = "login",
  onBack,
}: {
  initialMode?: Mode;
  onBack?: () => void;
}) {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [esqueci, setEsqueci] = useState(false);

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

  const { data: authCfg } = trpc.auth.authConfig.useQuery();
  const isPending = loginMutation.isPending || signupMutation.isPending;

  // Falha no callback do Google volta para /login?error=<code>. Mostra o aviso
  // e limpa a querystring (sem deixar o erro grudado na URL).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && GOOGLE_ERROS[err]) {
      toast.error(GOOGLE_ERROS[err]);
      params.delete("error");
      const q = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (q ? `?${q}` : "")
      );
    }
  }, []);

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
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        )}
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

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setEsqueci(true)}
                className="w-full text-center text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
          </form>

          {authCfg?.googleEnabled && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                ou
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 bg-white text-slate-800 hover:bg-slate-100"
                onClick={() => {
                  window.location.href = "/api/auth/google";
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
                  />
                </svg>
                Continuar com Google
              </Button>
            </>
          )}
        </div>
      </div>

      <EsqueciSenhaDialog aberto={esqueci} onFechar={() => setEsqueci(false)} />
    </div>
  );
}
