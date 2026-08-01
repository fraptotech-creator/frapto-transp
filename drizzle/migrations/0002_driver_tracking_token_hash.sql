ALTER TABLE `drivers` ADD `trackingTokenHash` varchar(64);--> statement-breakpoint
ALTER TABLE `drivers` ADD `trackingTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `drivers` ADD `trackingTokenRotatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `drivers` ADD `trackingTokenRevokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `drivers` ADD CONSTRAINT `drivers_tracking_token_hash_unico` UNIQUE(`trackingTokenHash`);