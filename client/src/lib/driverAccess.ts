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
export function mensagemAtivacao(p: { usuario: string; link: string }): string {
  return [
    "Seu acesso ao Frapto Transp:",
    "",
    `Usuário: ${p.usuario}`,
    `Crie sua senha por este link (uso único, vale 7 dias):`,
    p.link,
    "",
    "Depois é só entrar com seu usuário e a senha que você criar.",
  ].join("\n");
}
