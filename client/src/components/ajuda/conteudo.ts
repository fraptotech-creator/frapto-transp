// Conteúdo da Central de Ajuda (/ajuda): os módulos do sistema e, em cada um,
// as funções com o passo a passo. Dado PURO (sem React) para ser testado: todo
// vídeo citado precisa existir em client/public/ajuda e o texto só pode
// descrever o que o sistema faz hoje.
//
// Os vídeos foram gravados no próprio app com uma empresa FICTÍCIA
// ("Transportes Vale Verde"), nunca com dados de cliente.

export type ModuloId =
  | "primeiros-passos"
  | "veiculos"
  | "motoristas"
  | "viagens"
  | "app-motorista"
  | "manutencao"
  | "financeiro"
  | "relatorios"
  | "documentos"
  | "alertas"
  | "assistente"
  | "configuracoes";

export type Topico = {
  id: string;
  titulo: string;
  resumo: string;
  passos: string[];
  dica?: string;
  // Vídeo em /ajuda/<id>.mp4 com capa /ajuda/<id>.jpg. "vertical" = gravado
  // na tela de celular.
  video?: { vertical?: boolean };
};

export type Modulo = {
  id: ModuloId;
  titulo: string;
  descricao: string;
  topicos: Topico[];
};

export const MODULOS: Modulo[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    descricao: "Crie a conta e conheça a tela inicial.",
    topicos: [
      {
        id: "criar-conta",
        titulo: "Criar a sua conta",
        resumo: "Cadastre a sua empresa em menos de um minuto.",
        passos: [
          "Na página do Frapto Transp, clique em Assinar.",
          "Mais rápido: clique em Continuar com Google e escolha a sua conta do Google.",
          "Ou preencha o nome da empresa, o seu nome (opcional), o e-mail e uma senha de pelo menos 8 caracteres e clique em Criar conta.",
          "Ative a assinatura para liberar o sistema.",
        ],
        dica: "Criou com o Google? Para entrar depois, use o mesmo botão Continuar com Google. Esqueceu a senha? Na tela de entrar, clique em “Esqueci minha senha” e receba o link por e-mail.",
        video: {},
      },
      {
        id: "painel",
        titulo: "Entender o Painel",
        resumo: "O resumo da frota que aparece assim que você entra.",
        passos: [
          "No alto, os totais de veículos, motoristas, viagens e alertas.",
          "No meio, as viagens de cada mês e a situação da frota.",
          "Embaixo, os alertas importantes: manutenção atrasada e CRLV, seguro ou CNH perto de vencer, com a data.",
        ],
        video: {},
      },
    ],
  },
  {
    id: "veiculos",
    titulo: "Veículos",
    descricao: "Cadastro da frota, quilometragem e vencimentos.",
    topicos: [
      {
        id: "veiculo-cadastrar",
        titulo: "Cadastrar um veículo",
        resumo: "Placa, modelo, quilometragem e vencimentos em um formulário.",
        passos: [
          "No menu, abra Veículos e clique em Cadastrar Novo Veículo.",
          "Preencha placa, marca, modelo, ano e o tipo (caminhão, van, ônibus ou carro).",
          "Informe a quilometragem atual e de quantos em quantos km o óleo é trocado.",
          "Coloque os vencimentos do CRLV e do seguro para receber os alertas.",
          "Clique em Cadastrar Veículo.",
        ],
        dica: "Na lista, a busca acha o veículo pela placa. O lápis do cartão edita e a lixeira exclui.",
        video: {},
      },
      {
        id: "veiculo-ficha",
        titulo: "Ver a ficha de um veículo",
        resumo: "Tudo sobre um veículo em uma tela só.",
        passos: [
          "Em Veículos, clique no cartão do veículo.",
          "Veja os dados, a quilometragem e a próxima troca de óleo.",
          "Role a tela para ver as manutenções e as viagens feitas com ele.",
        ],
        video: {},
      },
    ],
  },
  {
    id: "motoristas",
    titulo: "Motoristas",
    descricao: "Cadastro da equipe, CNH e acesso ao app.",
    topicos: [
      {
        id: "motorista-cadastrar",
        titulo: "Cadastrar um motorista e enviar o acesso",
        resumo:
          "O motorista recebe pelo WhatsApp o link para criar a senha dele.",
        passos: [
          "No menu, abra Motoristas e clique em Cadastrar Novo Motorista.",
          "Preencha nome, CPF, telefone com WhatsApp e os dados da CNH (número, categoria e vencimento).",
          "Crie o usuário de acesso (ex.: joao.silva). É com ele que o motorista entra no app.",
          "Clique em Cadastrar Motorista.",
          "Na janela que abre, envie pelo WhatsApp: vai o link de ativação, para ele criar a própria senha, e o link do app.",
        ],
        dica: "O sistema avisa antes de a CNH vencer. Clique no nome do motorista para ver o histórico de viagens dele.",
        video: {},
      },
    ],
  },
  {
    id: "viagens",
    titulo: "Viagens",
    descricao: "Do cadastro da viagem ao acompanhamento no mapa.",
    topicos: [
      {
        id: "viagem-cadastrar",
        titulo: "Cadastrar uma viagem",
        resumo: "Veículo, motorista, rota, data e valor do frete.",
        passos: [
          "No menu, abra Viagens e clique em Cadastrar Nova Viagem.",
          "Informe o número da viagem e escolha o veículo e o motorista.",
          "Digite a cidade de origem e a de destino. Se houver, adicione paradas no caminho.",
          "Escolha a data e a hora da partida.",
          "Clique em Calcular pela rota para preencher a distância e informe o valor do frete.",
          "Clique em Confirmar e Cadastrar Viagem.",
        ],
        video: {},
      },
      {
        id: "viagem-iniciar",
        titulo: "Iniciar uma viagem",
        resumo: "Marque a saída do veículo com um clique.",
        passos: [
          "Em Viagens, encontre a viagem Planejada.",
          "Clique em Iniciar.",
          "A viagem passa para Em trânsito. O motorista também pode iniciar pelo app.",
        ],
        dica: "Use o filtro no alto da lista para ver só as viagens de um status ou de uma data.",
        video: {},
      },
      {
        id: "viagem-rastrear",
        titulo: "Acompanhar a viagem no mapa",
        resumo: "Veja por onde o veículo passou e onde ele está agora.",
        passos: [
          "Em Viagens, clique em Rastrear na viagem Em trânsito.",
          "O mapa mostra o caminho feito e a última posição, com a hora e a velocidade.",
          "Se quiser, abra a rota no Waze ou no Google Maps.",
        ],
        dica: "A posição chega pelo app do motorista enquanto a viagem está em andamento.",
        video: {},
      },
    ],
  },
  {
    id: "app-motorista",
    titulo: "App do motorista",
    descricao: "O que o motorista vê e faz no celular.",
    topicos: [
      {
        id: "app-motorista",
        titulo: "Como o motorista usa o app",
        resumo: "Entrar, iniciar a viagem, abrir o Waze e concluir.",
        passos: [
          "O motorista instala o app pelo link que você enviou no WhatsApp.",
          "Entra com o usuário e a senha dele.",
          "Na primeira vez, autoriza o rastreio durante as viagens.",
          "Vê só as viagens dele, sem os valores, e toca em Iniciar viagem na saída.",
          "Pode abrir a rota no Waze e, ao chegar, toca em Concluir viagem.",
        ],
        dica: "Com o app instalado, a posição é enviada mesmo com a tela apagada ou com o Waze aberto.",
        video: { vertical: true },
      },
      {
        id: "app-instalar",
        titulo: "Instalar o app no celular",
        resumo:
          "O motorista instala direto pelo link, sem loja de aplicativos.",
        passos: [
          "No celular Android, o motorista abre o link recebido e entra com o usuário e a senha.",
          "Toca em Instalar o app e espera o download.",
          "Abre o arquivo baixado. Se o celular pedir, permite instalar a partir do navegador.",
          "Toca em Instalar e abre o app. O ícone fica na tela do celular.",
          "No iPhone: no Safari, toca em Compartilhar e depois em “Adicionar à Tela de Início”.",
        ],
        video: { vertical: true },
      },
    ],
  },
  {
    id: "manutencao",
    titulo: "Manutenção",
    descricao: "Agende serviços e registre o que foi feito.",
    topicos: [
      {
        id: "manutencao",
        titulo: "Agendar e concluir uma manutenção",
        resumo: "O sistema avisa quando a data chega e guarda o custo.",
        passos: [
          "No menu, abra Manutenção e clique em Nova.",
          "Escolha o veículo e informe o tipo, a descrição, a data prevista e o custo estimado.",
          "Clique em Cadastrar Manutenção.",
          "Quando o serviço for feito, clique em Atualizar Status e escolha Concluída.",
          "Informe a data em que o serviço foi feito e o custo final e clique em Atualizar Status.",
        ],
        dica: "Manutenção perto da data ou atrasada aparece nos alertas do Painel.",
        video: {},
      },
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    descricao: "Despesas e receitas da frota.",
    topicos: [
      {
        id: "financeiro",
        titulo: "Lançar despesas e receitas",
        resumo: "Combustível, pedágio, manutenção, fretes recebidos e mais.",
        passos: [
          "No menu, abra Financeiro e clique em Nova Despesa.",
          "Escolha o tipo e, se quiser, o veículo da despesa.",
          "Informe a descrição, o valor, a data e a forma de pagamento.",
          "Clique em Salvar Despesa.",
          "Na aba Receitas, registre da mesma forma o que a empresa recebeu.",
        ],
        video: {},
      },
    ],
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    descricao: "Receita, despesa e lucro por período.",
    topicos: [
      {
        id: "relatorios",
        titulo: "Ver e exportar relatórios",
        resumo: "Os números do período, prontos para planilha ou PDF.",
        passos: [
          "No menu, abra Relatórios.",
          "Escolha o período no alto da tela.",
          "Veja a receita, as despesas e o lucro do período e, nos gráficos, a evolução mês a mês e o status das viagens.",
          "Em Exportar Dados, baixe frota, motoristas, viagens, manutenções ou financeiro em CSV (planilha) ou PDF.",
        ],
        video: {},
      },
    ],
  },
  {
    id: "documentos",
    titulo: "Documentos",
    descricao: "CRLV, CNH, seguro e outros arquivos guardados.",
    topicos: [
      {
        id: "documentos",
        titulo: "Guardar um documento",
        resumo: "Envie o arquivo e o sistema avisa antes de vencer.",
        passos: [
          "No menu, abra Documentos.",
          "Escolha o tipo (CRLV, seguro, CNH e outros) e, se quiser, escreva uma descrição.",
          "Se quiser, ligue o documento a um veículo ou a um motorista.",
          "Informe o vencimento para receber o alerta.",
          "Escolha o arquivo (PDF, JPG, PNG ou WEBP, até 10 MB) e clique em Enviar.",
        ],
        dica: "Na lista, você visualiza, baixa ou exclui cada documento.",
        video: {},
      },
    ],
  },
  {
    id: "alertas",
    titulo: "Alertas",
    descricao: "Tudo o que vence ou está atrasado.",
    topicos: [
      {
        id: "notificacoes",
        titulo: "Ver e ajustar os alertas",
        resumo: "Escolha o que avisar e com quantos dias de antecedência.",
        passos: [
          "No menu, abra Notificações para ver todos os alertas da frota.",
          "Para ajustar, abra Configurações e vá até Notificações.",
          "Ligue ou desligue cada alerta e informe com quantos dias antes ele deve aparecer.",
          "Clique em Salvar notificações.",
        ],
        video: {},
      },
    ],
  },
  {
    id: "assistente",
    titulo: "Assistente de IA",
    descricao: "Pergunte sobre a frota em português.",
    topicos: [
      {
        id: "assistente",
        titulo: "Perguntar ao assistente",
        resumo: "Respostas com os dados da sua empresa.",
        passos: [
          "No menu, abra Assistente IA.",
          "Toque em uma das sugestões ou escreva a sua pergunta.",
          "O assistente consulta os dados da sua empresa e responde.",
        ],
        dica: "Se o assistente estiver desligado, ative em Configurações.",
        video: {},
      },
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Assistente, alertas e assinatura.",
    topicos: [
      {
        id: "configuracoes",
        titulo: "Ajustar o sistema e a assinatura",
        resumo: "Tudo o que é configuração fica numa tela só.",
        passos: [
          "No menu, abra Configurações.",
          "Em Assistente de IA, ligue ou desligue o assistente.",
          "Em Notificações, escolha os alertas e a antecedência de cada um.",
          "Em Assinatura, acompanhe e gerencie o seu plano.",
        ],
        video: {},
      },
    ],
  },
];

export const caminhoVideo = (id: string): string => `/ajuda/${id}.mp4`;
export const caminhoCapa = (id: string): string => `/ajuda/${id}.jpg`;
export const ancoraTopico = (id: string): string => `topico-${id}`;

const normalizar = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Busca da Central (PURA): ignora acento e maiúscula, aceita várias palavras
// em qualquer ordem e procura no título, no resumo e nos passos. O nome do
// módulo também conta ("motoristas" acha tudo do módulo Motoristas).
export function filtrarModulos(modulos: Modulo[], busca: string): Modulo[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return modulos;
  return modulos
    .map(m => ({
      ...m,
      topicos: m.topicos.filter(t => {
        const texto = normalizar(
          [m.titulo, t.titulo, t.resumo, ...t.passos, t.dica ?? ""].join(" ")
        );
        return termos.every(termo => texto.includes(termo));
      }),
    }))
    .filter(m => m.topicos.length > 0);
}
