import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  Bus,
  CalendarClock,
  ClipboardList,
  DollarSign,
  FileText,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

// TODO o texto da página de vendas. REGRA: só entra aqui o que o sistema FAZ
// de verdade (conferido no código em 24/11/2026). Nada de número inventado,
// depoimento ou logo de cliente que não existe. Mudou o produto? Mude aqui.
// Preço tem de bater com Paywall.tsx, Termos.tsx e o preço da Stripe.

export const PRECO_MENSAL = 57;
export const PRECO_TEXTO = "R$ 57";
// 57 / 30 = 1,90 — "menos de R$ 2 por dia" é conta, não promessa.
export const PRECO_POR_DIA_TEXTO = "menos de R$ 2 por dia";

export type Item = { icon: LucideIcon; titulo: string; texto: string };

// Para quem é (segmentos que o cadastro atende: capacidade por peso OU por
// passageiros, manifesto de embarque, motorista contratado ou freelancer).
export const SEGMENTOS: Item[] = [
  {
    icon: Bus,
    titulo: "Fretamento e turismo",
    texto: "Vans e ônibus, com lista de passageiros por viagem.",
  },
  {
    icon: Truck,
    titulo: "Transporte de carga",
    texto: "Caminhões e utilitários, com peso, carga e destino.",
  },
  {
    icon: Building2,
    titulo: "Frota própria de empresa",
    texto: "Quem tem veículos rodando e precisa de controle.",
  },
];

// Dor no formato da PERGUNTA que o dono da frota faz (padrão de referência:
// a pessoa se reconhece). A resposta é sempre uma função que existe.
export type Dor = { pergunta: string; resposta: string; icon: LucideIcon };
export const DORES: Dor[] = [
  {
    icon: MapPin,
    pergunta: "Onde está a van agora?",
    resposta:
      "A viagem em andamento aparece no mapa, com a posição do motorista atualizada a cada 15 segundos. Sem ligar para ninguém.",
  },
  {
    icon: CalendarClock,
    pergunta: "Quando vence a CNH do João?",
    resposta:
      "O sistema avisa antes de vencer CNH, CRLV, seguro e documentos — e motorista com CNH vencida já aparece como indisponível.",
  },
  {
    icon: Wrench,
    pergunta: "Já passou da troca de óleo?",
    resposta:
      "A quilometragem sobe sozinha a cada viagem concluída e o sistema avisa quando a troca está chegando ou atrasou.",
  },
  {
    icon: DollarSign,
    pergunta: "Quanto sobrou dessa viagem?",
    resposta:
      "Valor da viagem, despesas do veículo, o que já entrou e o que falta receber — com o lucro do mês num relatório pronto.",
  },
];

// Faixa de confiança logo abaixo do hero: só FATOS verificáveis (sem logo de
// cliente, sem número de clientes — não temos).
export const FATOS = [
  `Preço aberto: ${PRECO_TEXTO}/mês por empresa`,
  "Sem fidelidade e sem multa",
  "7 dias de arrependimento",
  "Empresa brasileira com CNPJ",
];

// Destaques com ilustração (a ilustração de cada um está em Ilustracoes.tsx).
export type Destaque = {
  id: "mapa" | "alertas" | "financeiro" | "motorista" | "ia";
  selo: string;
  titulo: string;
  texto: string;
  pontos: string[];
};
export const DESTAQUES: Destaque[] = [
  {
    id: "mapa",
    selo: "Rastreamento",
    titulo: "Veja no mapa onde cada viagem está",
    texto:
      "Enquanto a viagem está em andamento, o celular do motorista envia a posição e você acompanha o trajeto no mapa — sem ligar para ninguém.",
    pontos: [
      "Posição ao vivo, atualizada a cada 15 segundos",
      "Trajeto percorrido desenhado no mapa",
      "Só registra durante a viagem — fora dela, nada é coletado",
    ],
  },
  {
    id: "alertas",
    selo: "Alertas",
    titulo: "Nada vence sem você saber",
    texto:
      "O sistema avisa antes de vencer a CNH do motorista, o CRLV e o seguro do veículo, os documentos que você enviou e as manutenções e trocas de óleo.",
    pontos: [
      "Você escolhe com quantos dias de antecedência quer ser avisado",
      "Documentos (CRLV, CNH, seguro) guardados e vinculados ao veículo ou motorista",
      "Motorista com CNH vencida aparece como indisponível",
    ],
  },
  {
    id: "financeiro",
    selo: "Financeiro",
    titulo: "Saiba quanto cada viagem rendeu",
    texto:
      "Lance o valor da viagem e as despesas do veículo. O sistema separa o que já recebeu do que falta receber e mostra o lucro do mês.",
    pontos: [
      "Recebido × a receber × despesas × lucro",
      "Despesas por veículo (combustível, pedágio, peças…)",
      "Relatórios em PDF e planilha (CSV)",
    ],
  },
  {
    id: "motorista",
    selo: "App do motorista",
    titulo: "O motorista só vê o que precisa",
    texto:
      "Cada motorista entra com o próprio acesso, vê só as viagens dele, inicia e conclui a corrida e abre a rota no Waze ou no Google Maps com um toque.",
    pontos: [
      "Funciona no navegador de qualquer celular",
      "Motorista não vê valores nem o financeiro",
      "App Android de rastreio para o GPS seguir ativo em segundo plano",
    ],
  },
  {
    id: "ia",
    selo: "Assistente de IA",
    titulo: "Pergunte e a frota responde",
    texto:
      'Escreva em português — "quais CNHs vencem este mês?", "quanto gastei com o veículo ABC-1234?" — e o assistente consulta os seus dados e responde.',
    pontos: [
      "Já vem pronto, sem configurar nada",
      "Só consulta: nunca altera seus dados",
      "Não recebe CPF, telefone nem endereço dos motoristas",
    ],
  },
];

// Grade completa de recursos.
export const RECURSOS: Item[] = [
  {
    icon: Truck,
    titulo: "Veículos",
    texto:
      "Placa, quilometragem, capacidade (peso ou passageiros) e vencimentos.",
  },
  {
    icon: Users,
    titulo: "Motoristas",
    texto: "CNH e categoria, contratado ou freelancer, disponibilidade.",
  },
  {
    icon: Route,
    titulo: "Viagens e rotas",
    texto: "Distância calculada, paradas no caminho e ordem otimizada.",
  },
  {
    icon: ClipboardList,
    titulo: "Lista de passageiros",
    texto: "Manifesto de embarque da viagem, pronto para imprimir.",
  },
  {
    icon: Wrench,
    titulo: "Manutenção",
    texto: "Agendamentos, custos e controle de troca de óleo.",
  },
  {
    icon: DollarSign,
    titulo: "Financeiro",
    texto: "Receitas, despesas, a receber e lucro por período.",
  },
  {
    icon: FileText,
    titulo: "Documentos",
    texto: "CRLV, CNH e seguro guardados, com vencimento e vínculo.",
  },
  {
    icon: BarChart3,
    titulo: "Relatórios",
    texto: "Painel com gráficos e exportação em PDF e CSV.",
  },
  {
    icon: Bell,
    titulo: "Notificações",
    texto: "Tudo que vence ou atrasa, numa lista só.",
  },
  {
    icon: Bot,
    titulo: "Assistente de IA",
    texto: "Respostas sobre a sua frota em português.",
  },
  {
    icon: Smartphone,
    titulo: "App do motorista",
    texto: "Viagens do dia, início e fim da corrida, Waze.",
  },
  {
    icon: Navigation,
    titulo: "Rastreamento",
    texto: "Trajeto da viagem no mapa, ao vivo.",
  },
];

export const PASSOS = [
  {
    titulo: "Crie a conta e assine",
    texto: `Cadastro em minutos e assinatura de ${PRECO_TEXTO}/mês pelo pagamento seguro da Stripe.`,
  },
  {
    titulo: "Cadastre veículos e motoristas",
    texto:
      "Placa, documentos e vencimentos. Cada motorista recebe um link para criar o próprio acesso.",
  },
  {
    titulo: "Lance as viagens e acompanhe",
    texto:
      "O motorista inicia a viagem no celular e você acompanha no mapa, com alertas e financeiro em dia.",
  },
];

export const PLANO_INCLUI = [
  "Veículos, motoristas e viagens sem limite",
  "Rastreamento das viagens no mapa",
  "App do motorista e app Android de rastreio",
  "Alertas de CNH, CRLV, seguro, documentos e óleo",
  "Financeiro, relatórios e exportação PDF/CSV",
  "Assistente de IA incluso",
  "Rotas e navegação (Waze/Google Maps) sem custo extra",
];

export const CONFIANCA: Item[] = [
  {
    icon: ShieldCheck,
    titulo: "Dados da sua empresa isolados",
    texto: "Cada empresa só enxerga os próprios dados — conferido no servidor.",
  },
  {
    icon: ShieldCheck,
    titulo: "Pagamento pela Stripe",
    texto: "Não guardamos o seu cartão. Cancelamento online, sem multa.",
  },
  {
    icon: ShieldCheck,
    titulo: "Empresa brasileira e LGPD",
    texto: "Termos e Política de Privacidade claros, com CNPJ e endereço.",
  },
];

export const FAQ = [
  {
    p: "Preciso instalar alguma coisa?",
    r: "Não. O painel funciona no navegador do computador ou do celular. O motorista também usa pelo navegador; para o GPS continuar ativo com o celular bloqueado ou com o Waze aberto, existe o app Android de rastreio.",
  },
  {
    p: "Funciona no iPhone?",
    r: "O painel e o app do motorista funcionam em qualquer celular pelo navegador. O rastreamento em segundo plano, hoje, é pelo app Android.",
  },
  {
    p: "Tem limite de veículos ou motoristas?",
    r: `Não. O plano de ${PRECO_TEXTO}/mês é por empresa, com veículos, motoristas e viagens sem limite. Para documentos enviados, o espaço é de 5 GB por empresa.`,
  },
  {
    p: "Tem período de teste grátis?",
    r: "Não há teste grátis, mas você tem 7 dias de arrependimento: se desistir nesse prazo, devolvemos o valor pago integralmente.",
  },
  {
    p: "Tem fidelidade? Como cancelo?",
    r: "Sem fidelidade e sem multa. Você cancela sozinho em Configurações → Assinatura, e o acesso continua até o fim do mês já pago.",
  },
  {
    p: "O motorista vê quanto a empresa cobra?",
    r: "Não. O motorista vê apenas as próprias viagens (rota, horários, passageiros). Valores e financeiro ficam só com a gestão.",
  },
  {
    p: "Serve para transporte de passageiros e de carga?",
    r: "Sim. Cada veículo tem capacidade por peso ou por passageiros, e as viagens de passageiros têm lista de embarque.",
  },
  {
    p: "Meus dados ficam seguros?",
    r: "Sim. A conexão é criptografada, cada empresa só acessa os próprios dados e o tratamento segue a LGPD, como descrito na Política de Privacidade.",
  },
];
