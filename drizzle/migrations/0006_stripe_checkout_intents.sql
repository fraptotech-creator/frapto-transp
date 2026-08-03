CREATE TABLE `stripe_checkout_intents` (
	`orgId` int NOT NULL,
	`idempotencyKey` varchar(80) NOT NULL,
	`sessionUrl` varchar(600),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_checkout_intents_orgId` PRIMARY KEY(`orgId`)
);
