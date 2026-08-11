ALTER TABLE `band` ADD `custom_domain` text;--> statement-breakpoint
ALTER TABLE `band` ADD `custom_domain_status` text;--> statement-breakpoint
ALTER TABLE `band` ADD `custom_domain_hostname_id` text;--> statement-breakpoint
ALTER TABLE `band` ADD `custom_domain_verification` text;--> statement-breakpoint
ALTER TABLE `band` ADD `custom_domain_added_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_band_custom_domain` ON `band` (`custom_domain`);