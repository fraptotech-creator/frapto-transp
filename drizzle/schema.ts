import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de veículos/frotas
export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  placa: varchar("placa", { length: 10 }).notNull().unique(),
  marca: varchar("marca", { length: 50 }).notNull(),
  modelo: varchar("modelo", { length: 50 }).notNull(),
  ano: int("ano").notNull(),
  tipo: mysqlEnum("tipo", ["caminhao", "van", "onibus", "carro"]).notNull(),
  status: mysqlEnum("status", ["ativo", "manutencao", "inativo"])
    .default("ativo")
    .notNull(),
  capacidadeCarga: decimal("capacidadeCarga", { precision: 10, scale: 2 }),
  quilometragem: int("quilometragem").default(0),
  proximaManutencao: timestamp("proximaManutencao"),
  crlvVencimento: timestamp("crlvVencimento"),
  seguroVencimento: timestamp("seguroVencimento"),
  rastreadorId: varchar("rastreadorId", { length: 100 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

// Tabela de motoristas
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  email: varchar("email", { length: 100 }),
  telefone: varchar("telefone", { length: 20 }),
  cnh: varchar("cnh", { length: 20 }).notNull().unique(),
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
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// Tabela de viagens/rotas
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  numeroViagem: varchar("numeroViagem", { length: 20 }).notNull().unique(),
  motoristaId: int("motoristaId").notNull(),
  veiculoId: int("veiculoId").notNull(),
  origem: varchar("origem", { length: 150 }).notNull(),
  destino: varchar("destino", { length: 150 }).notNull(),
  dataPartida: timestamp("dataPartida").notNull(),
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
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

// Tabela de manutenção de veículos
export const maintenance = mysqlTable("maintenance", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type Maintenance = typeof maintenance.$inferSelect;
export type InsertMaintenance = typeof maintenance.$inferInsert;

// Tabela de notificações
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
// Tabela de despesas operacionais
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// Tabela de receitas
export const revenues = mysqlTable("revenues", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type Revenue = typeof revenues.$inferSelect;
export type InsertRevenue = typeof revenues.$inferInsert;

// Tabela de documentos (veículos e motoristas)
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Configuração do assistente de IA — editável na tela de Configurações (admin).
// Linha única (id=1). A apiKey é secreta: nunca é devolvida ao browser (mascarada).
export const aiConfig = mysqlTable("ai_config", {
  id: int("id").autoincrement().primaryKey(),
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
