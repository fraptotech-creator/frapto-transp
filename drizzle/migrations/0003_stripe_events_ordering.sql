CREATE TABLE `stripe_events` (
	`id` varchar(255) NOT NULL,
	`eventType` varchar(100),
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `lastStripeEventAt` timestamp;