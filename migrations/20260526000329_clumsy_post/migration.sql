CREATE TABLE `inbox_channel_config` (
	`id` text PRIMARY KEY,
	`channel` text NOT NULL UNIQUE,
	`enabled` integer DEFAULT false NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_message` (
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	`direction` text NOT NULL,
	`body` text NOT NULL,
	`body_html` text,
	`author_name` text,
	`author_user_id` text,
	`channel_message_id` text,
	`channel_metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_inbox_message_thread_id_inbox_thread_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `inbox_thread`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_inbox_message_author_user_id_user_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_note` (
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_inbox_note_thread_id_inbox_thread_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `inbox_thread`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_inbox_note_author_user_id_user_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `inbox_thread` (
	`id` text PRIMARY KEY,
	`channel` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`subject` text,
	`preview` text,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`contact_external_id` text,
	`assigned_to_user_id` text,
	`snoozed_until` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_inbox_thread_assigned_to_user_id_user_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reservation` (
	`id` text PRIMARY KEY,
	`booker_type` text NOT NULL,
	`booker_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`notes` text,
	`cancellation_reason` text,
	`stripe_payment_record_id` text,
	`paid_at` integer,
	`refunded_at` integer,
	`lock_access_id` text,
	`recurring_series_id` text,
	`waitlist_notified_at` integer,
	`waitlist_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_reservation_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reservation_recurring_series_id_recurring_series_id_fk` FOREIGN KEY (`recurring_series_id`) REFERENCES `recurring_series`(`id`) ON DELETE SET NULL,
	CONSTRAINT "reservation_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
INSERT INTO `__new_reservation`(`id`, `booker_type`, `booker_id`, `created_by_user_id`, `status`, `starts_at`, `ends_at`, `notes`, `cancellation_reason`, `stripe_payment_record_id`, `paid_at`, `refunded_at`, `lock_access_id`, `recurring_series_id`, `waitlist_notified_at`, `waitlist_expires_at`, `created_at`, `updated_at`) SELECT `id`, `booker_type`, `booker_id`, `created_by_user_id`, `status`, `starts_at`, `ends_at`, `notes`, `cancellation_reason`, `stripe_payment_record_id`, `paid_at`, `refunded_at`, `lock_access_id`, `recurring_series_id`, `waitlist_notified_at`, `waitlist_expires_at`, `created_at`, `updated_at` FROM `reservation`;--> statement-breakpoint
DROP TABLE `reservation`;--> statement-breakpoint
ALTER TABLE `__new_reservation` RENAME TO `reservation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_reservation_conflict` ON `reservation` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_reservation_user` ON `reservation` (`created_by_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reservation_booker` ON `reservation` (`booker_type`,`booker_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recurring_instance` ON `reservation` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL AND status != 'cancelled';--> statement-breakpoint
CREATE INDEX `idx_reservation_waitlist_expires` ON `reservation` (`waitlist_expires_at`) WHERE status = 'waitlisted' AND waitlist_expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_inbox_message_thread` ON `inbox_message` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_inbox_message_channel_id` ON `inbox_message` (`channel_message_id`);--> statement-breakpoint
CREATE INDEX `idx_inbox_note_thread` ON `inbox_note` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_status` ON `inbox_thread` (`status`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_channel` ON `inbox_thread` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_assigned` ON `inbox_thread` (`assigned_to_user_id`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_last_message` ON `inbox_thread` (`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_contact_email` ON `inbox_thread` (`contact_email`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_contact_phone` ON `inbox_thread` (`contact_phone`);--> statement-breakpoint
CREATE INDEX `idx_inbox_thread_contact_ext` ON `inbox_thread` (`channel`,`contact_external_id`);