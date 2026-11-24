CREATE TABLE `trip_trajeto_resumos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`tripId` int NOT NULL,
	`pontos` json NOT NULL,
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trip_trajeto_resumos_id` PRIMARY KEY(`id`),
	CONSTRAINT `trip_trajeto_resumos_viagem` UNIQUE(`orgId`,`tripId`)
);
--> statement-breakpoint
CREATE INDEX `trip_positions_captured_idx` ON `trip_positions` (`capturedAt`);