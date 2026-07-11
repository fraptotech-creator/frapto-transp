import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  unique,
  index,
} from "drizzle-orm/mysql-core";

/**
 * SaaS multi-tenant: cada empresa (organization) tem seus próprios dados.
 * Toda tabela de domínio carrega `orgId` e é filtrada por ele nas consultas.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  // Stripe / assinatura (Fase B)
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", [
    "none",
    "trialing",
    "active",
    "past_due",
    "canceled",
  ])
    .default("none")
    .notNull(),
  planName: varchar("planName", { length: 100 }),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Usuário. Login por email+senha (passwordHash). Pertence a uma organização.
 * openId é o identificador de sessão (único). email é a chave de login (único).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  orgId: int("orgId"),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Papel dentro da organização.
  orgRole: mysqlEnum("orgRole", ["owner", "member"])
    .default("member")
    .notNull(),
  // Papel global do app (super-admin da plataforma, se necessário).
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Revogação de sessão: o token embute este número; logout incrementa,
  // invalidando todos os cookies antigos (mesmo o roubado).
  sessionVersion: int("sessionVersion").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de veículos/frotas
export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    placa: varchar("placa", { length: 10 }).notNull(),
    marca: varchar("marca", { length: 50 }).notNull(),
    modelo: varchar("modelo", { length: 50 }).notNull(),
    ano: int("ano").notNull(),
    tipo: mysqlEnum("tipo", ["caminhao", "van", "onibus", "carro"]).notNull(),
    status: mysqlEnum("status", ["ativo", "manutencao", "inativo"])
      .default("ativo")
      .notNull(),
    capacidadeCarga: decimal("capacidadeCarga", { precision: 10, scale: 2 }),
    quilometragem: int("quilometragem").default(0),
    // Troca de óleo por km: intervalo (padrão 10.000) e o odômetro registrado
    // na última troca. Próxima troca = kmUltimaTrocaOleo + intervaloTrocaOleoKm.
    intervaloTrocaOleoKm: int("intervaloTrocaOleoKm").default(10000).notNull(),
    kmUltimaTrocaOleo: int("kmUltimaTrocaOleo").default(0).notNull(),
    proximaManutencao: timestamp("proximaManutencao"),
    crlvVencimento: timestamp("crlvVencimento"),
    seguroVencimento: timestamp("seguroVencimento"),
    rastreadorId: varchar("rastreadorId", { length: 100 }),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    placaPorOrg: unique("vehicles_placa_por_org").on(t.orgId, t.placa),
  })
);

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

// Tabela de motoristas
export const drivers = mysqlTable(
  "drivers",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    nome: varchar("nome", { length: 100 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    email: varchar("email", { length: 100 }),
    telefone: varchar("telefone", { length: 20 }),
    cnh: varchar("cnh", { length: 20 }).notNull(),
    cnhCategoria: varchar("cnhCategoria", { length: 5 }).notNull(),
    cnhVencimento: timestamp("cnhVencimento").notNull(),
    status: mysqlEnum("status", [
      "disponivel",
      "viagem",
      "descansando",
      "inativo",
    ])
      .default("disponivel")
      .notNull(),
    disponibilidade: boolean("disponibilidade").default(true).notNull(),
    endereco: text("endereco"),
    dataAdmissao: timestamp("dataAdmissao").defaultNow().notNull(),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    cpfPorOrg: unique("drivers_cpf_por_org").on(t.orgId, t.cpf),
    cnhPorOrg: unique("drivers_cnh_por_org").on(t.orgId, t.cnh),
    // Telefone é opcional; MySQL permite múltiplos NULL, então motoristas sem
    // telefone não conflitam — só bloqueia quando o mesmo número se repete.
    telefonePorOrg: unique("drivers_telefone_por_org").on(t.orgId, t.telefone),
  })
);

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// Tabela de viagens/rotas
export const trips = mysqlTable(
  "trips",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    numeroViagem: varchar("numeroViagem", { length: 20 }).notNull(),
    motoristaId: int("motoristaId").notNull(),
    veiculoId: int("veiculoId").notNull(),
    origem: varchar("origem", { length: 150 }).notNull(),
    destino: varchar("destino", { length: 150 }).notNull(),
    dataPartida: timestamp("dataPartida").notNull(),
    // Previsão de chegada no cliente (planejada); dataChegada é a chegada REAL.
    previsaoChegada: timestamp("previsaoChegada"),
    dataChegada: timestamp("dataChegada"),
    status: mysqlEnum("status", [
      "planejada",
      "em_andamento",
      "concluida",
      "cancelada",
    ])
      .default("planejada")
      .notNull(),
    distancia: decimal("distancia", { precision: 10, scale: 2 }),
    carga: text("carga"),
    pesoTotal: decimal("pesoTotal", { precision: 10, scale: 2 }),
    valor: decimal("valor", { precision: 12, scale: 2 }),
    // Idempotência: vira true quando a distância já foi somada ao odômetro do
    // veículo (na conclusão da viagem), pra nunca contar em dobro.
    quilometragemAplicada: boolean("quilometragemAplicada")
      .default(false)
      .notNull(),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    numeroPorOrg: unique("trips_numero_por_org").on(t.orgId, t.numeroViagem),
  })
);

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

// Tabela de manutenção de veículos
export const maintenance = mysqlTable(
  "maintenance",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    veiculoId: int("veiculoId").notNull(),
    tipo: varchar("tipo", { length: 50 }).notNull(),
    descricao: text("descricao").notNull(),
    dataPrevista: timestamp("dataPrevista").notNull(),
    dataRealizada: timestamp("dataRealizada"),
    custo: decimal("custo", { precision: 12, scale: 2 }),
    status: mysqlEnum("status", ["pendente", "em_andamento", "concluida"])
      .default("pendente")
      .notNull(),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    orgIdx: index("maintenance_org_idx").on(t.orgId),
  })
);

export type Maintenance = typeof maintenance.$inferSelect;
export type InsertMaintenance = typeof maintenance.$inferInsert;

// Tabela de notificações
export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    usuarioId: int("usuarioId").notNull(),
    tipo: mysqlEnum("tipo", [
      "manutencao",
      "documento",
      "viagem",
      "alerta",
    ]).notNull(),
    titulo: varchar("titulo", { length: 150 }).notNull(),
    mensagem: text("mensagem").notNull(),
    referenceId: int("referenceId"),
    referenceType: varchar("referenceType", { length: 50 }),
    lida: boolean("lida").default(false).notNull(),
    urgencia: mysqlEnum("urgencia", ["baixa", "media", "alta", "critica"])
      .default("media")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    orgIdx: index("notifications_org_idx").on(t.orgId),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Tabela de despesas operacionais
export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    tipo: mysqlEnum("tipo", [
      "combustivel",
      "manutencao",
      "pedagio",
      "seguro",
      "salario",
      "outros",
    ]).notNull(),
    descricao: text("descricao").notNull(),
    valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
    data: timestamp("data").notNull(),
    veiculoId: int("veiculoId"),
    motoristId: int("motoristId"),
    viagemId: int("viagemId"),
    categoria: varchar("categoria", { length: 50 }),
    formaPagamento: varchar("formaPagamento", { length: 50 }),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    orgIdx: index("expenses_org_idx").on(t.orgId),
  })
);

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// Tabela de receitas
export const revenues = mysqlTable(
  "revenues",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    tipo: mysqlEnum("tipo", ["viagem", "frete", "servico", "outros"]).notNull(),
    descricao: text("descricao").notNull(),
    valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
    data: timestamp("data").notNull(),
    viagemId: int("viagemId"),
    clienteNome: varchar("clienteNome", { length: 150 }),
    clienteCpfCnpj: varchar("clienteCpfCnpj", { length: 20 }),
    formaPagamento: varchar("formaPagamento", { length: 50 }),
    status: mysqlEnum("status", ["pendente", "recebido", "cancelado"])
      .default("pendente")
      .notNull(),
    observacoes: text("observacoes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    orgIdx: index("revenues_org_idx").on(t.orgId),
  })
);

export type Revenue = typeof revenues.$inferSelect;
export type InsertRevenue = typeof revenues.$inferInsert;

// Tabela de documentos (veículos e motoristas)
export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull(),
    tipo: mysqlEnum("tipo", [
      "crlv",
      "seguro",
      "cnh",
      "rg",
      "cpf",
      "outro",
    ]).notNull(),
    descricao: varchar("descricao", { length: 150 }),
    veiculoId: int("veiculoId"),
    motoristId: int("motoristId"),
    dataVencimento: timestamp("dataVencimento"),
    arquivoUrl: text("arquivoUrl"),
    arquivoKey: varchar("arquivoKey", { length: 255 }),
    status: mysqlEnum("status", ["ativo", "vencido", "proximo_vencer"])
      .default("ativo")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    orgIdx: index("documents_org_idx").on(t.orgId),
  })
);

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Configuração do assistente de IA — uma por organização (editável por admin da org).
// A apiKey é secreta: nunca é devolvida ao browser (mascarada).
export const aiConfig = mysqlTable("ai_config", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull().unique(),
  provider: mysqlEnum("provider", ["anthropic", "openai", "openai_compatible"])
    .default("anthropic")
    .notNull(),
  apiKey: text("apiKey"),
  model: varchar("model", { length: 100 }),
  baseUrl: varchar("baseUrl", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiConfig = typeof aiConfig.$inferSelect;
export type InsertAiConfig = typeof aiConfig.$inferInsert;
