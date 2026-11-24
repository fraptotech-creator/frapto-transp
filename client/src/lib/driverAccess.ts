// Acesso do motorista: endereço do app e mensagem pronta para enviar.
// Funções puras — testadas em server/driverAccess.test.ts.

// O app do motorista vive numa rota própria, fora do login por e-mail.
// Ela não aparecia em nenhum lugar do sistema, então o gestor não tinha o que
// informar ao motorista — e quem recebia o link principal caía na tela errada.
export function urlAppMotorista(origem: string): string {
  return `${origem.replace(/\/+$/, "")}/motorista`;
}

// Link de ATIVAÇÃO de uso único: o motorista abre, cria a própria senha e cai
// direto no app (?next=/motorista). Reaproveita a página /redefinir-senha.
// Substitui o envio de senha em texto — nada de credencial trafegando.
export function linkAtivacao(origem: string, token: string): string {
  const base = origem.replace(/\/+$/, "");
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}&next=/motorista`;
}

// Texto pronto para colar no WhatsApp. Manda o LINK e o usuário — sem senha.
// UM link só: ele cria a senha e cai no app do motorista, que mostra o botão
// de instalar o app no celular (Android) ou o passo a passo (iPhone).
export function mensagemAtivacao(p: { usuario: string; link: string }): string {
  return [
    "Seu acesso ao Frapto Transp:",
    "",
    `Usuário: ${p.usuario}`,
    `Crie sua senha por este link (uso único, vale 7 dias):`,
    p.link,
    "",
    "Depois de criar a senha, toque em *Instalar o app* para colocar o ícone na tela do seu celular.",
  ].join("\n");
}

// Para motorista que JÁ tem senha: só o link do app (instala por lá).
export function mensagemApp(url: string): string {
  return [
    "App do motorista Frapto Transp:",
    url,
    "",
    "Entre com seu usuário e senha e toque em *Instalar o app* para colocar o ícone na tela do seu celular.",
  ].join("\n");
}

// Link do WhatsApp com a mensagem pronta. Com o telefone do motorista, abre a
// conversa DELE direto; sem telefone (ou inválido), abre o WhatsApp para o
// gestor escolher o contato. Telefone brasileiro: DDD + número (10 ou 11
// dígitos) ganha o 55; quem já vem com 55 fica como está.
// No COMPUTADOR vai direto para o WhatsApp Web: o wa.me deixava o sistema
// decidir e abria o app de desktop (pedido do dono, 24/11/2026). No celular
// segue o wa.me, que abre o app do WhatsApp.
export function linkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string,
  noComputador = false
): string {
  const texto = `text=${encodeURIComponent(mensagem)}`;
  const d = (telefone ?? "").replace(/\D/g, "");
  let numero = "";
  if (d.length === 10 || d.length === 11) numero = `55${d}`;
  else if ((d.length === 12 || d.length === 13) && d.startsWith("55"))
    numero = d;
  if (noComputador) {
    return numero
      ? `https://web.whatsapp.com/send?phone=${numero}&${texto}`
      : `https://web.whatsapp.com/send?${texto}`;
  }
  return numero
    ? `https://wa.me/${numero}?${texto}`
    : `https://wa.me/?${texto}`;
}

// Atributos do <a> do WhatsApp. No computador: aba com NOME fixo, para o 2º
// envio reaproveitar o WhatsApp Web já aberto (ele só funciona numa aba por vez
// e demora a carregar) — sem noopener, que faria abrir aba nova toda vez; o
// destino é sempre o domínio oficial do WhatsApp. No celular: _blank isolado.
export function alvoWhatsApp(noComputador: boolean): {
  target: string;
  rel?: string;
} {
  return noComputador
    ? { target: "frapto-whatsapp" }
    : { target: "_blank", rel: "noopener noreferrer" };
}
