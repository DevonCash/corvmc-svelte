CREATE TABLE `site_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `equipment_loan` ADD `estimated_return_date` text;--> statement-breakpoint
ALTER TABLE `equipment_loan` ADD `estimated_cost_cents` integer;