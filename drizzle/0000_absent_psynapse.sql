CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand_model` text DEFAULT '' NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`location` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`image_url` text,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_equipment_asset_code` ON `equipment` (`asset_code`);--> statement-breakpoint
CREATE INDEX `idx_equipment_filters` ON `equipment` (`status`,`category`,`location`);--> statement-breakpoint
CREATE TABLE `loan_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	`condition_before` text DEFAULT 'ปกติ' NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `loan_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_loan_item_request_equipment` ON `loan_items` (`request_id`,`equipment_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_items_equipment` ON `loan_items` (`equipment_id`);--> statement-breakpoint
CREATE TABLE `loan_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_code` text NOT NULL,
	`borrower_auth_id` text NOT NULL,
	`borrower_name` text NOT NULL,
	`start_at` text NOT NULL,
	`due_at` text NOT NULL,
	`purpose` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loan_requests_request_code_unique` ON `loan_requests` (`request_code`);--> statement-breakpoint
CREATE INDEX `idx_requests_borrower_status` ON `loan_requests` (`borrower_auth_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_requests_dates` ON `loan_requests` (`start_at`,`due_at`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_name_unique` ON `locations` (`name`);--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	`condition_after` text NOT NULL,
	`damage_details` text DEFAULT '' NOT NULL,
	`damage_photo_key` text,
	`fine_amount` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`received_by` text NOT NULL,
	`returned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `loan_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_returns_request_equipment` ON `returns` (`request_id`,`equipment_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_returned_at` ON `returns` (`returned_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_auth_id` ON `users` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);