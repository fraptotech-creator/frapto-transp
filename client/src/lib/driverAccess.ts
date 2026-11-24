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

// Link do WhatsApp (wa.me) com a mensagem pronta. Com o telefone do motorista,
// abre a conversa DELE direto; sem telefone (ou inválido), abre o WhatsApp para
// o gestor escolher o contato. Telefone brasileiro: DDD + número (10 ou 11
// dígitos) ganha o 55; quem já vem com 55 fica como está.
export function linkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string
): string {
  const texto = `text=${encodeURIComponent(mensagem)}`;
  const d = (telefone ?? "").replace(/\D/g, "");
  let numero = "";
  if (d.length === 10 || d.length === 11) numero = `55${d}`;
  else if ((d.length === 12 || d.length === 13) && d.startsWith("55"))
    numero = d;
  return numero
    ? `https://wa.me/${numero}?${texto}`
    : `https://wa.me/?${texto}`;
}
