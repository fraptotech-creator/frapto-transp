ALTER TABLE `vehicles` ADD `capacidadeTipo` enum('peso','passageiros') DEFAULT 'peso' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `capacidadePassageiros` int;