CREATE TABLE `band_media` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_media_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `band_page_config` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`theme` text DEFAULT 'default' NOT NULL,
	`custom_css` text,
	`blocks` text DEFAULT '[]' NOT NULL,
	`epk` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_page_config_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `event` ADD `band_id` text REFERENCES band(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `source` text DEFAULT 'cmc' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `location` text;--> statement-breakpoint
ALTER TABLE `event` ADD `external_ticket_url` text;--> statement-breakpoint
ALTER TABLE `band` ADD `tier` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `band` ADD `subscription` text;--> statement-breakpoint
CREATE INDEX `idx_event_band` ON `event` (`band_id`);--> statement-breakpoint
CREATE INDEX `idx_event_source` ON `event` (`source`,`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_band_media_band_type` ON `band_media` (`band_id`,`type`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_band_page_config_band` ON `band_page_config` (`band_id`);