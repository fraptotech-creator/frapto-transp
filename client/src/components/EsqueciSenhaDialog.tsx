import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function EsqueciSenhaDialog({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  const pedir = trpc.auth.forgotPassword.useMutation({
    // O servidor responde igual exista ou não o e-mail — de propósito, para
    // não virar oráculo de quem é cliente. A tela segue a mesma regra.
    onSuccess: () => setEnviado(true),
    onError: e => toast.error(e.message),
  });

  const fechar = () => {
    onFechar();
    setTimeout(() => {
      setEnviado(false);
      setEmail("");
    }, 200);
  };

  return (
    <Dialog open={aberto} onOpenChange={a => !a && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {enviado ? "Verifique seu e-mail" : "Esqueci minha senha"}
          </DialogTitle>
          <DialogDescription>
            {enviado
              ? "Se houver uma conta com esse e-mail, o link de recuperação chegou."
              : "Informe o e-mail da conta. Enviaremos um link para criar uma nova senha."}
          </DialogDescription>
        </DialogHeader>

        {enviado ? (
          <div className="space-y-3 py-2 text-sm">
            <MailCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="text-center text-muted-foreground">
              O link vale por <strong>1 hora</strong>. Se não chegar em alguns
              minutos, confira a caixa de spam.
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Motoristas entram por usuário e senha no aplicativo — a
              recuperação deles é feita pelo gestor da empresa.
            </p>
          </div>
        )}

        <DialogFooter>
          {enviado ? (
            <Button onClick={fechar}>Fechar</Button>
          ) : (
            <Button
              disabled={!email.includes("@") || pedir.isPending}
              onClick={() => pedir.mutate({ email })}
            >
              {pedir.isPending ? "Enviando…" : "Enviar link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
