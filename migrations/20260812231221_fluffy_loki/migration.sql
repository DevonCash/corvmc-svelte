CREATE TABLE `inbox_participant` (
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`last_read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_inbox_participant_thread_id_inbox_thread_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `inbox_thread`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_inbox_participant_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inbox_participant_thread_user` ON `inbox_participant` (`thread_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_inbox_participant_user` ON `inbox_participant` (`user_id`);