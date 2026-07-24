CREATE TABLE `ai_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`provider` enum('anthropic','openai','openai_compatible') NOT NULL DEFAULT 'anthropic',
	`apiKey` text,
	`model` varchar(100),
	`baseUrl` varchar(255),
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_config_orgId_unique` UNIQUE(`orgId`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`tipo` enum('crlv','seguro','cnh','rg','cpf','outro') NOT NULL,
	`descricao` varchar(150),
	`veiculoId` int,
	`motoristId` int,
	`dataVencimento` timestamp,
	`arquivoUrl` text,
	`arquivoKey` varchar(255),
	`status` enum('ativo','vencido','proximo_vencer') NOT NULL DEFAULT 'ativo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`nome` varchar(100) NOT NULL,
	`cpf` varchar(14) NOT NULL,
	`email` varchar(100),
	`telefone` varchar(20),
	`cnh` varchar(20) NOT NULL,
	`cnhCategoria` varchar(5) NOT NULL,
	`cnhVencimento` timestamp NOT NULL,
	`status` enum('disponivel','viagem','descansando','inativo') NOT NULL DEFAULT 'disponivel',
	`disponibilidade` boolean NOT NULL DEFAULT true,
	`endereco` text,
	`dataAdmissao` timestamp NOT NULL DEFAULT (now()),
	`observacoes` text,
	`trackingToken` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_cpf_por_org` UNIQUE(`orgId`,`cpf`),
	CONSTRAINT `drivers_cnh_por_org` UNIQUE(`orgId`,`cnh`),
	CONSTRAINT `drivers_telefone_por_org` UNIQUE(`orgId`,`telefone`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`tipo` enum('combustivel','manutencao','pedagio','seguro','salario','outros') NOT NULL,
	`descricao` text NOT NULL,
	`valor` decimal(12,2) NOT NULL,
	`data` timestamp NOT NULL,
	`veiculoId` int,
	`motoristId` int,
	`viagemId` int,
	`categoria` varchar(50),
	`formaPagamento` varchar(50),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`veiculoId` int NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`descricao` text NOT NULL,
	`dataPrevista` timestamp NOT NULL,
	`dataRealizada` timestamp,
	`custo` decimal(12,2),
	`status` enum('pendente','em_andamento','concluida') NOT NULL DEFAULT 'pendente',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`tipo` enum('manutencao','documento','viagem','alerta') NOT NULL,
	`titulo` varchar(150) NOT NULL,
	`mensagem` text NOT NULL,
	`referenceId` int,
	`referenceType` varchar(50),
	`lida` boolean NOT NULL DEFAULT false,
	`urgencia` enum('baixa','media','alta','critica') NOT NULL DEFAULT 'media',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`subscriptionStatus` enum('none','trialing','active','past_due','canceled') NOT NULL DEFAULT 'none',
	`planName` varchar(100),
	`trialEndsAt` timestamp,
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`tipo` enum('viagem','frete','servico','outros') NOT NULL,
	`descricao` text NOT NULL,
	`valor` decimal(12,2) NOT NULL,
	`data` timestamp NOT NULL,
	`viagemId` int,
	`clienteNome` varchar(150),
	`clienteCpfCnpj` varchar(20),
	`formaPagamento` varchar(50),
	`status` enum('pendente','recebido','cancelado') NOT NULL DEFAULT 'pendente',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`tripId` int NOT NULL,
	`veiculoId` int,
	`lat` decimal(10,7) NOT NULL,
	`lng` decimal(10,7) NOT NULL,
	`velocidade` decimal(6,2),
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`numeroViagem` varchar(20) NOT NULL,
	`motoristaId` int NOT NULL,
	`veiculoId` int NOT NULL,
	`origem` varchar(150) NOT NULL,
	`destino` varchar(150) NOT NULL,
	`dataPartida` timestamp NOT NULL,
	`previsaoChegada` timestamp,
	`dataChegada` timestamp,
	`status` enum('planejada','em_andamento','concluida','cancelada') NOT NULL DEFAULT 'planejada',
	`distancia` decimal(10,2),
	`carga` text,
	`pesoTotal` decimal(10,2),
	`valor` decimal(12,2),
	`pago` boolean NOT NULL DEFAULT false,
	`quilometragemAplicada` boolean NOT NULL DEFAULT false,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trips_id` PRIMARY KEY(`id`),
	CONSTRAINT `trips_numero_por_org` UNIQUE(`orgId`,`numeroViagem`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`orgId` int,
	`name` text,
	`email` varchar(320),
	`username` varchar(64),
	`passwordHash` text,
	`loginMethod` varchar(64),
	`driverId` int,
	`mustChangePassword` boolean NOT NULL DEFAULT false,
	`orgRole` enum('owner','member','driver') NOT NULL DEFAULT 'member',
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`sessionVersion` int NOT NULL DEFAULT 0,
	`resetTokenHash` varchar(64),
	`resetTokenExpiraEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`placa` varchar(10) NOT NULL,
	`marca` varchar(50) NOT NULL,
	`modelo` varchar(50) NOT NULL,
	`ano` int NOT NULL,
	`tipo` enum('caminhao','van','onibus','carro') NOT NULL,
	`status` enum('ativo','manutencao','inativo') NOT NULL DEFAULT 'ativo',
	`capacidadeCarga` decimal(10,2),
	`quilometragem` int DEFAULT 0,
	`intervaloTrocaOleoKm` int NOT NULL DEFAULT 10000,
	`kmUltimaTrocaOleo` int NOT NULL DEFAULT 0,
	`proximaManutencao` timestamp,
	`crlvVencimento` timestamp,
	`seguroVencimento` timestamp,
	`rastreadorId` varchar(100),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_placa_por_org` UNIQUE(`orgId`,`placa`)
);
--> statement-breakpoint
CREATE INDEX `documents_org_idx` ON `documents` (`orgId`);--> statement-breakpoint
CREATE INDEX `expenses_org_idx` ON `expenses` (`orgId`);--> statement-breakpoint
CREATE INDEX `maintenance_org_idx` ON `maintenance` (`orgId`);--> statement-breakpoint
CREATE INDEX `notifications_org_idx` ON `notifications` (`orgId`);--> statement-breakpoint
CREATE INDEX `revenues_org_idx` ON `revenues` (`orgId`);--> statement-breakpoint
CREATE INDEX `trip_positions_trip_idx` ON `trip_positions` (`orgId`,`tripId`);