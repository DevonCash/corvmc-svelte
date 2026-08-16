CREATE TABLE `messaging_standing` (
	`user_id` text PRIMARY KEY,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`reason` text,
	`triggering_flag_id` text,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_messaging_standing_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_messaging_standing_triggering_flag_id_content_flag_id_fk` FOREIGN KEY (`triggering_flag_id`) REFERENCES `content_flag`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_messaging_standing_updated_by_user_id_user_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `user_block` (
	`id` text PRIMARY KEY,
	`blocker_user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_user_block_blocker_user_id_user_id_fk` FOREIGN KEY (`blocker_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_block_blocked_user_id_user_id_fk` FOREIGN KEY (`blocked_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `inbox_participant` ADD `accepted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_inbox_participant_user_accepted` ON `inbox_participant` (`user_id`,`accepted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_block_pair` ON `user_block` (`blocker_user_id`,`blocked_user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_block_blocked` ON `user_block` (`blocked_user_id`);