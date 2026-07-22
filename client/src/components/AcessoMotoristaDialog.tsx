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
import { urlAppMotorista, mensagemAcessoMotorista } from "@/lib/driverAccess";

/**
 * Mostra o acesso do motorista de forma PERSISTENTE.
 *
 * Antes isto era um toast: sumia em segundos, não dizia o ENDEREÇO do app do
 * motorista (que não aparecia em lugar nenhum do sistema) e, se o gestor
 * piscasse, a senha se perdia. O motorista que recebesse o link principal
 * cairia na tela de e-mail — mas o login dele é por usuário.
 */
export default function AcessoMotoristaDialog({
  aberto,
  onFechar,
  usuario,
  senha,
}: {
  aberto: boolean;
  onFechar: () => void;
  usuario: string;
  senha: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const url = urlAppMotorista(window.location.origin);
  const mensagem = mensagemAcessoMotorista({ url, usuario, senha });

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
            Anote ou envie agora. A senha não será exibida de novo — depois só
            gerando uma nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Endereço do app</span>
            <p className="font-mono break-all">{url}</p>
          </div>
          <div className="flex gap-6">
            <div>
              <span className="text-muted-foreground">Usuário</span>
              <p className="font-mono">{usuario}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Senha inicial</span>
              <p className="font-mono">{senha}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O motorista entra por <strong>usuário e senha</strong>, não por
            e-mail — por isso o endereço acima é diferente do seu.
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
