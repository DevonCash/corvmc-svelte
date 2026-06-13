CREATE TABLE `content_flag` (
	`id` text PRIMARY KEY,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`reported_by_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by_user_id` text,
	`resolution_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	CONSTRAINT `fk_content_flag_reported_by_user_id_user_id_fk` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_content_flag_resolved_by_user_id_user_id_fk` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `content_flag_status_idx` ON `content_flag` (`status`);--> statement-breakpoint
CREATE INDEX `content_flag_entity_idx` ON `content_flag` (`entity_type`,`entity_id`);