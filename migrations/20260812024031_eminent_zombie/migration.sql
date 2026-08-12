CREATE TABLE `member_certification` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`certification_id` text NOT NULL,
	`granted_at` integer NOT NULL,
	`expires_at` integer,
	`granted_by_user_id` text,
	`reference` text,
	`notes` text,
	`revoked_at` integer,
	`revoked_reason` text,
	`revoked_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_member_certification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_member_certification_certification_id_volunteer_certification_id_fk` FOREIGN KEY (`certification_id`) REFERENCES `volunteer_certification`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_member_certification_granted_by_user_id_user_id_fk` FOREIGN KEY (`granted_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_member_certification_revoked_by_user_id_user_id_fk` FOREIGN KEY (`revoked_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "member_certification_revoked_has_reason" CHECK((revoked_at IS NULL) = (revoked_reason IS NULL))
);
--> statement-breakpoint
CREATE TABLE `volunteer_certification` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`issued_by` text,
	`validity_months` integer,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `volunteer_role_certification` (
	`volunteer_role_id` text NOT NULL,
	`certification_id` text NOT NULL,
	CONSTRAINT `volunteer_role_certification_pk` PRIMARY KEY(`volunteer_role_id`, `certification_id`),
	CONSTRAINT `fk_volunteer_role_certification_volunteer_role_id_volunteer_role_id_fk` FOREIGN KEY (`volunteer_role_id`) REFERENCES `volunteer_role`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_volunteer_role_certification_certification_id_volunteer_certification_id_fk` FOREIGN KEY (`certification_id`) REFERENCES `volunteer_certification`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `volunteer_role_interest` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`volunteer_role_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_role_interest_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_volunteer_role_interest_volunteer_role_id_volunteer_role_id_fk` FOREIGN KEY (`volunteer_role_id`) REFERENCES `volunteer_role`(`id`) ON DELETE CASCADE,
	CONSTRAINT `uq_volunteer_role_interest` UNIQUE(`user_id`,`volunteer_role_id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_shift` (
	`id` text PRIMARY KEY,
	`volunteer_role_id` text NOT NULL,
	`event_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`capacity` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`cancelled_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_shift_volunteer_role_id_volunteer_role_id_fk` FOREIGN KEY (`volunteer_role_id`) REFERENCES `volunteer_role`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_volunteer_shift_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_volunteer_shift_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "volunteer_shift_ends_after_start" CHECK(ends_at > starts_at),
	CONSTRAINT "volunteer_shift_capacity_positive" CHECK(capacity > 0)
);
--> statement-breakpoint
CREATE TABLE `volunteer_shift_feedback` (
	`id` text PRIMARY KEY,
	`signup_id` text NOT NULL UNIQUE,
	`rating` integer NOT NULL,
	`was_set_up` integer NOT NULL,
	`comment` text,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_shift_feedback_signup_id_volunteer_signup_id_fk` FOREIGN KEY (`signup_id`) REFERENCES `volunteer_signup`(`id`) ON DELETE CASCADE,
	CONSTRAINT "volunteer_shift_feedback_rating_range" CHECK(rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE `volunteer_signup` (
	`id` text PRIMARY KEY,
	`shift_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`claimed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`confirmed_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_signup_shift_id_volunteer_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `volunteer_shift`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_volunteer_signup_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `uq_volunteer_signup` UNIQUE(`shift_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `volunteer_role` ADD `group` text DEFAULT 'at-shows' NOT NULL;--> statement-breakpoint
ALTER TABLE `volunteer_role` ADD `default_duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `volunteer_role` ADD `default_capacity` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_volunteer_hour_log` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`volunteer_role_id` text NOT NULL,
	`shift_id` text,
	`worked_on` integer NOT NULL,
	`minutes` integer NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`review_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_volunteer_hour_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_volunteer_hour_log_volunteer_role_id_volunteer_role_id_fk` FOREIGN KEY (`volunteer_role_id`) REFERENCES `volunteer_role`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_volunteer_hour_log_shift_id_volunteer_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `volunteer_shift`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_volunteer_hour_log_reviewed_by_user_id_user_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "volunteer_minutes_positive" CHECK(minutes > 0 AND minutes <= 1440)
);
--> statement-breakpoint
INSERT INTO `__new_volunteer_hour_log`(`id`, `user_id`, `volunteer_role_id`, `shift_id`, `worked_on`, `minutes`, `description`, `status`, `reviewed_by_user_id`, `reviewed_at`, `review_notes`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `volunteer_role_id`, `shift_id`, `worked_on`, `minutes`, `description`, `status`, `reviewed_by_user_id`, `reviewed_at`, `review_notes`, `created_at`, `updated_at` FROM `volunteer_hour_log`;--> statement-breakpoint
DROP TABLE `volunteer_hour_log`;--> statement-breakpoint
ALTER TABLE `__new_volunteer_hour_log` RENAME TO `volunteer_hour_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `volunteer_hour_log_user_idx` ON `volunteer_hour_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `volunteer_hour_log_status_idx` ON `volunteer_hour_log` (`status`,`worked_on`);--> statement-breakpoint
CREATE INDEX `volunteer_hour_log_worked_on_idx` ON `volunteer_hour_log` (`worked_on`);--> statement-breakpoint
CREATE INDEX `volunteer_hour_log_role_idx` ON `volunteer_hour_log` (`volunteer_role_id`);--> statement-breakpoint
CREATE INDEX `member_certification_user_idx` ON `member_certification` (`user_id`,`certification_id`);--> statement-breakpoint
CREATE INDEX `member_certification_expiry_idx` ON `member_certification` (`expires_at`) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX `volunteer_role_certification_cert_idx` ON `volunteer_role_certification` (`certification_id`);--> statement-breakpoint
CREATE INDEX `volunteer_role_interest_role_idx` ON `volunteer_role_interest` (`volunteer_role_id`);--> statement-breakpoint
CREATE INDEX `volunteer_role_interest_user_idx` ON `volunteer_role_interest` (`user_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_upcoming_idx` ON `volunteer_shift` (`starts_at`) WHERE cancelled_at IS NULL;--> statement-breakpoint
CREATE INDEX `volunteer_shift_role_idx` ON `volunteer_shift` (`volunteer_role_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_event_idx` ON `volunteer_shift` (`event_id`);--> statement-breakpoint
CREATE INDEX `volunteer_shift_feedback_submitted_idx` ON `volunteer_shift_feedback` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `volunteer_signup_shift_idx` ON `volunteer_signup` (`shift_id`,`status`);--> statement-breakpoint
CREATE INDEX `volunteer_signup_user_idx` ON `volunteer_signup` (`user_id`,`status`);