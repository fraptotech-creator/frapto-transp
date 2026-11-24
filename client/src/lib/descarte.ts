// Fechar formulário por ACIDENTE (Esc ou clique fora da janela) apagava tudo o
// que já tinha sido digitado, sem perguntar — teste pré-venda 23/11/2026
// (digitado "ABC" no cadastro de veículo + Esc → reabriu vazio). Regra PURA:
// só pergunta se o formulário é protegido E o usuário já mexeu em algum campo.
// Fechar pelo X ou pelo "Cancelar" é intencional e segue sem pergunta.
export const PERGUNTA_DESCARTE =
  "Descartar o que você preencheu? Os dados digitados neste formulário serão perdidos.";

export function precisaConfirmarDescarte(
  protegido: boolean,
  alterado: boolean
): boolean {
  return protegido && alterado;
}
