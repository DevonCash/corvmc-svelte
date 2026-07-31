PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_content_flag` (
	`id` text PRIMARY KEY,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`reported_by_user_id` text,
	`reason` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by_user_id` text,
	`resolution_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	CONSTRAINT `fk_content_flag_reported_by_user_id_user_id_fk` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_content_flag_resolved_by_user_id_user_id_fk` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_content_flag`(`id`, `entity_type`, `entity_id`, `reported_by_user_id`, `reason`, `description`, `status`, `resolved_by_user_id`, `resolution_notes`, `created_at`, `updated_at`, `resolved_at`) SELECT `id`, `entity_type`, `entity_id`, `reported_by_user_id`, `reason`, `description`, `status`, `resolved_by_user_id`, `resolution_notes`, `created_at`, `updated_at`, `resolved_at` FROM `content_flag`;--> statement-breakpoint
DROP TABLE `content_flag`;--> statement-breakpoint
ALTER TABLE `__new_content_flag` RENAME TO `content_flag`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `content_flag_status_idx` ON `content_flag` (`status`);--> statement-breakpoint
CREATE INDEX `content_flag_entity_idx` ON `content_flag` (`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `trial_ends_at`;