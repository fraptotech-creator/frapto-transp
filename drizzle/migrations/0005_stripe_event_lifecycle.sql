ALTER TABLE `stripe_events` ADD `status` enum('processing','processed','failed') DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_events` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_events` ADD `lastError` varchar(200);--> statement-breakpoint
ALTER TABLE `stripe_events` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;