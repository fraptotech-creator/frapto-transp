CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
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
CREATE TABLE `revenues` (
	`id` int AUTO_INCREMENT NOT NULL,
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
