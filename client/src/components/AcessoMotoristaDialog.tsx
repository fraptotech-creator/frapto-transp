import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { linkAtivacao, mensagemAtivacao } from "@/lib/driverAccess";

/**
 * Mostra o ACESSO do motorista de forma PERSISTENTE — agora com link de
 * ativação, não senha em texto. O gestor compartilha o link (uso único); o
 * motorista cria a própria senha e cai direto no app. Nenhuma credencial
 * trafega por WhatsApp.
 */
export default function AcessoMotoristaDialog({
  aberto,
  onFechar,
  usuario,
  token,
}: {
  aberto: boolean;
  onFechar: () => void;
  usuario: string;
  token: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const link = linkAtivacao(window.location.origin, token);
  const mensagem = mensagemAtivacao({ usuario, link });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      toast.success("Mensagem copiada. Cole no WhatsApp do motorista.");
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Clipboard bloqueado (contexto inseguro/permissão): o texto continua
      // visível na tela, então o gestor copia à mão. Não é erro fatal.
      toast.error(
        "Não consegui copiar. Selecione o texto e copie manualmente."
      );
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={a => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso do motorista</DialogTitle>
          <DialogDescription>
            Envie o link abaixo ao motorista. Ele cria a própria senha (uso
            único, vale 7 dias). O link não será exibido de novo — depois é só
            gerar um novo em "Resetar senha".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Usuário</span>
            <p className="font-mono">{usuario}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Link de ativação</span>
            <p className="font-mono break-all">{link}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Não enviamos senha por mensagem: o motorista define a dele pelo
            link. Depois, ele entra por <strong>usuário e senha</strong>.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copiar}>
            {copiado ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copiar mensagem pronta
          </Button>
          <Button onClick={onFechar}>Já anotei</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
