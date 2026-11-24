import { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LINK_DOWNLOAD_APP, plataformaDoCelular } from "@/lib/instalarApp";

const CHAVE_OCULTO = "frapto_instalar_app_oculto";

// Preferência local (esconder o cartão). Sem storage (aba anônima, bloqueio),
// o cartão só volta a aparecer — nada quebra.
function lerOculto(): boolean {
  try {
    return localStorage.getItem(CHAVE_OCULTO) === "1";
  } catch (e) {
    console.warn("[instalar-app] storage indisponível", e);
    return false;
  }
}

// Cartão "Instalar o app" no topo das viagens do motorista (app web).
// Android: baixa o APK do app do motorista (viagens + GPS em segundo plano).
// iPhone: não há APK — ensina a pôr o atalho na tela de início.
export default function InstalarAppMotorista() {
  const plataforma = plataformaDoCelular(navigator.userAgent);
  const [oculto, setOculto] = useState(lerOculto);
  if (plataforma === "outro" || oculto) return null;

  const esconder = () => {
    setOculto(true);
    try {
      localStorage.setItem(CHAVE_OCULTO, "1");
    } catch (e) {
      console.warn("[instalar-app] não salvou a preferência", e);
    }
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4 text-primary" />
            {plataforma === "android"
              ? "Instale o app Frapto Motorista"
              : "Coloque o app na tela do iPhone"}
          </div>
          <button
            type="button"
            onClick={esconder}
            className="text-muted-foreground"
            aria-label="Esconder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {plataforma === "android" ? (
          <>
            <p className="text-muted-foreground">
              Com o app, a sua localização é enviada mesmo com a tela apagada ou
              com o Waze aberto, e o ícone fica na tela do celular.
            </p>
            <Button asChild className="w-full">
              <a href={LINK_DOWNLOAD_APP}>
                <Download className="mr-2 h-4 w-4" /> Instalar o app
              </a>
            </Button>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Toque em Instalar o app e espere o download.</li>
              <li>
                Abra o arquivo baixado. Se o celular pedir, permita instalar a
                partir do navegador.
              </li>
              <li>Toque em Instalar e abra o app.</li>
              <li>Entre com o mesmo usuário e senha daqui.</li>
            </ol>
          </>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>No Safari, toque no botão Compartilhar (quadrado com seta).</li>
            <li>Toque em “Adicionar à Tela de Início”.</li>
            <li>
              Durante a viagem, deixe o app aberto para enviar a sua
              localização.
            </li>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
