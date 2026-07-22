// Acesso do motorista: endereço do app e mensagem pronta para enviar.
// Funções puras — testadas em server/driverAccess.test.ts.

// O app do motorista vive numa rota própria, fora do login por e-mail.
// Ela não aparecia em nenhum lugar do sistema, então o gestor não tinha o que
// informar ao motorista — e quem recebia o link principal caía na tela errada.
export function urlAppMotorista(origem: string): string {
  return `${origem.replace(/\/+$/, "")}/motorista`;
}

// Texto pronto para colar no WhatsApp. Formato pensado para o motorista ler no
// celular: endereço primeiro, credenciais depois, aviso da troca no fim.
export function mensagemAcessoMotorista(p: {
  url: string;
  usuario: string;
  senha: string;
}): string {
  return [
    "Seu acesso ao Frapto Transp:",
    "",
    `Endereço: ${p.url}`,
    `Usuário: ${p.usuario}`,
    `Senha: ${p.senha}`,
    "",
    "Você vai trocar a senha no primeiro acesso.",
  ].join("\n");
}
