CREATE TABLE `suggestion_edit` (
	`id` text PRIMARY KEY,
	`suggestion_id` text NOT NULL,
	`requested_by_user_id` text,
	`proposed_title` text NOT NULL,
	`proposed_body` text NOT NULL,
	`proposed_category` text NOT NULL,
	`original_title` text NOT NULL,
	`original_body` text NOT NULL,
	`original_category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_user_id` text,
	`review_notes` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_suggestion_edit_suggestion_id_suggestion_id_fk` FOREIGN KEY (`suggestion_id`) REFERENCES `suggestion`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_suggestion_edit_requested_by_user_id_user_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_suggestion_edit_reviewed_by_user_id_user_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `suggestion` ADD `edited_at` integer;--> statement-breakpoint
CREATE INDEX `suggestion_edit_suggestion_idx` ON `suggestion_edit` (`suggestion_id`);--> statement-breakpoint
CREATE INDEX `suggestion_edit_status_idx` ON `suggestion_edit` (`status`);--> statement-breakpoint
CREATE INDEX `suggestion_edit_requested_by_idx` ON `suggestion_edit` (`requested_by_user_id`);