// Identificação da empresa que fornece o Frapto Transp. Fonte ÚNICA para os
// Termos, a Política de Privacidade e os rodapés públicos — o Decreto
// 7.962/2013 (comércio eletrônico) exige razão social, CNPJ e endereço físico
// em local de destaque no site. Mudou algum dado? Mude só aqui.
export const EMPRESA = {
  razaoSocial: "FRAPTO TECH LTDA",
  cnpj: "51.156.210/0001-04",
  endereco: "Av. São Paulo, nº 92, quadra 50, Marcílio de Noronha, Viana/ES",
  email: "fraptotech@gmail.com",
} as const;

export const IDENTIFICACAO_EMPRESA = `${EMPRESA.razaoSocial} · CNPJ ${EMPRESA.cnpj} · ${EMPRESA.endereco}`;
