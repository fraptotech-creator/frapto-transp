CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cnhEnabled` boolean NOT NULL DEFAULT true,
	`cnhDiasAntes` int NOT NULL DEFAULT 30,
	`crlvEnabled` boolean NOT NULL DEFAULT true,
	`crlvDiasAntes` int NOT NULL DEFAULT 30,
	`manutencaoEnabled` boolean NOT NULL DEFAULT true,
	`manutencaoDiasAntes` int NOT NULL DEFAULT 7,
	`oleoEnabled` boolean NOT NULL DEFAULT true,
	`oleoPercentAntes` int NOT NULL DEFAULT 10,
	`documentosEnabled` boolean NOT NULL DEFAULT true,
	`documentosDiasAntes` int NOT NULL DEFAULT 30,
	`urgenciaAltaDiasAntes` int NOT NULL DEFAULT 7,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_orgId_unique` UNIQUE(`orgId`)
);
