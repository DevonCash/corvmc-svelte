CREATE TABLE `suggestion` (
	`id` text PRIMARY KEY,
	`author_user_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`visibility` text DEFAULT 'visible' NOT NULL,
	`visibility_note` text,
	`visibility_changed_at` integer,
	`visibility_changed_by_user_id` text,
	`response_body` text,
	`response_by_user_id` text,
	`response_at` integer,
	`merged_into_id` text,
	`merged_by_user_id` text,
	`merged_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_suggestion_author_user_id_user_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_suggestion_visibility_changed_by_user_id_user_id_fk` FOREIGN KEY (`visibility_changed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_suggestion_response_by_user_id_user_id_fk` FOREIGN KEY (`response_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_suggestion_merged_by_user_id_user_id_fk` FOREIGN KEY (`merged_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `suggestion_standing` (
	`user_id` text PRIMARY KEY,
	`requires_review` integer DEFAULT true NOT NULL,
	`reason` text,
	`triggering_flag_id` text,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_suggestion_standing_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_suggestion_standing_triggering_flag_id_content_flag_id_fk` FOREIGN KEY (`triggering_flag_id`) REFERENCES `content_flag`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_suggestion_standing_updated_by_user_id_user_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `suggestion_vote` (
	`id` text PRIMARY KEY,
	`suggestion_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_suggestion_vote_suggestion_id_suggestion_id_fk` FOREIGN KEY (`suggestion_id`) REFERENCES `suggestion`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_suggestion_vote_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `suggestion_status_idx` ON `suggestion` (`status`);--> statement-breakpoint
CREATE INDEX `suggestion_category_idx` ON `suggestion` (`category`);--> statement-breakpoint
CREATE INDEX `suggestion_visibility_idx` ON `suggestion` (`visibility`);--> statement-breakpoint
CREATE INDEX `suggestion_author_idx` ON `suggestion` (`author_user_id`);--> statement-breakpoint
CREATE INDEX `suggestion_merged_into_idx` ON `suggestion` (`merged_into_id`);--> statement-breakpoint
CREATE INDEX `suggestion_created_idx` ON `suggestion` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_suggestion_vote_suggestion_user` ON `suggestion_vote` (`suggestion_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_suggestion_vote_user` ON `suggestion_vote` (`user_id`);