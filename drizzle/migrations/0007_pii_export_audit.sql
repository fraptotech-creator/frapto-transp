CREATE TABLE `pii_export_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`exportType` varchar(40) NOT NULL,
	`recordCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pii_export_audit_id` PRIMARY KEY(`id`)
);
