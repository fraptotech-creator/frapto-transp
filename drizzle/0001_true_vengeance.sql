CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_cpf_unique` UNIQUE(`cpf`),
	CONSTRAINT `drivers_cnh_unique` UNIQUE(`cnh`)
);
--> statement-breakpoint
CREATE TABLE `maintenance` (
	`id` int AUTO_INCREMENT NOT NULL,
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
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numeroViagem` varchar(20) NOT NULL,
	`motoristId` int NOT NULL,
	`veiculoId` int NOT NULL,
	`origem` varchar(150) NOT NULL,
	`destino` varchar(150) NOT NULL,
	`dataPartida` timestamp NOT NULL,
	`dataChegada` timestamp,
	`status` enum('planejada','em_andamento','concluida','cancelada') NOT NULL DEFAULT 'planejada',
	`distancia` decimal(10,2),
	`carga` text,
	`pesoTotal` decimal(10,2),
	`valor` decimal(12,2),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trips_id` PRIMARY KEY(`id`),
	CONSTRAINT `trips_numeroViagem_unique` UNIQUE(`numeroViagem`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`placa` varchar(10) NOT NULL,
	`marca` varchar(50) NOT NULL,
	`modelo` varchar(50) NOT NULL,
	`ano` int NOT NULL,
	`tipo` enum('caminhao','van','onibus','carro') NOT NULL,
	`status` enum('ativo','manutencao','inativo') NOT NULL DEFAULT 'ativo',
	`capacidadeCarga` decimal(10,2),
	`quilometragem` int DEFAULT 0,
	`proximaManutencao` timestamp,
	`crlvVencimento` timestamp,
	`seguroVencimento` timestamp,
	`rastreadorId` varchar(100),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_placa_unique` UNIQUE(`placa`)
);
