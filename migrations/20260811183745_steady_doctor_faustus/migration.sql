CREATE TABLE `band_slug_history` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL,
	`band_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_slug_history_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_band_slug_history_slug` ON `band_slug_history` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_band_slug_history_band` ON `band_slug_history` (`band_id`);