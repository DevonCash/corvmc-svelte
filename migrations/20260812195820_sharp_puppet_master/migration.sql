CREATE TABLE `volunteer_profile` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`is_adult` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`availability` text,
	`approved_by_user_id` text,
	`approved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_profile_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_volunteer_profile_approved_by_user_id_user_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `volunteer_profile_status_idx` ON `volunteer_profile` (`status`,`created_at`);