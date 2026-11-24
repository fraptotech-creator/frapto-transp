// Instalação do app do motorista a partir do app web (/motorista). PURO.
// O link do WhatsApp leva o motorista a criar a senha e cair aqui; o cartão
// "Instalar o app" muda conforme o celular.

// Mesmo endereço servido pelo servidor (server/_core/appMotorista.ts — o teste
// garante que os dois batem). Redireciona para o APK da Release mais recente.
export const LINK_DOWNLOAD_APP = "/baixar/app-motorista.apk";

export type Plataforma = "android" | "ios" | "outro";

export function plataformaDoCelular(userAgent: string): Plataforma {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  // iPadOS moderno se apresenta como Mac; o "mobile" separa do Mac de verdade.
  if (
    /iphone|ipad|ipod/.test(ua) ||
    (ua.includes("macintosh") && ua.includes("mobile"))
  )
    return "ios";
  return "outro";
}
