CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`department` varchar(120) NOT NULL,
	`expenseCategory` varchar(120) NOT NULL,
	`estimatedAmount` decimal(14,2) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'SAR',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`transactionId` varchar(40) NOT NULL,
	`expenseDate` date NOT NULL,
	`period` varchar(7) NOT NULL,
	`department` varchar(120) NOT NULL,
	`expenseCategory` varchar(120) NOT NULL,
	`description` text,
	`actualAmount` decimal(14,2) NOT NULL,
	`paymentMethod` varchar(60) NOT NULL,
	`supportingDocument` enum('Available','Pending Review') NOT NULL DEFAULT 'Available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`department` varchar(120) NOT NULL,
	`expenseCategory` varchar(120) NOT NULL,
	`estimatedAmount` decimal(14,2) NOT NULL,
	`actualAmount` decimal(14,2) NOT NULL,
	`varianceAmount` decimal(14,2) NOT NULL,
	`variancePercent` decimal(8,2) NOT NULL,
	`priority` enum('High','Medium','Low') NOT NULL,
	`reason` text,
	`recommendedAction` text,
	`status` enum('Open','In Progress','Closed') NOT NULL DEFAULT 'Open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `followUps` ADD CONSTRAINT `followUps_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;