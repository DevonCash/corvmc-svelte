ALTER TABLE `reservation` ADD `waitlist_notified_at` integer;--> statement-breakpoint
ALTER TABLE `reservation` ADD `waitlist_expires_at` integer;--> statement-breakpoint
ALTER TABLE `recurring_series` ADD `created_by` text NOT NULL REFERENCES user(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_account`(`id`, `account_id`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`) SELECT `id`, `account_id`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at` FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_session`(`id`, `expires_at`, `token`, `created_at`, `updated_at`, `ip_address`, `user_agent`, `user_id`) SELECT `id`, `expires_at`, `token`, `created_at`, `updated_at`, `ip_address`, `user_agent`, `user_id` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`pronouns` text,
	`phone` text,
	`settings` text,
	`stripe_id` text,
	`pm_type` text,
	`pm_last_four` text,
	`credit_free_hours` integer DEFAULT 0 NOT NULL,
	`credit_equipment` integer DEFAULT 0 NOT NULL,
	`subscription` text,
	`trial_ends_at` integer,
	`deleted_at` integer,
	`bio` text,
	`tagline` text,
	`looking_for_band` integer DEFAULT false NOT NULL,
	`directory_visibility` text DEFAULT 'members' NOT NULL,
	`directory_contact` text,
	`links` text
);
--> statement-breakpoint
INSERT INTO `__new_user`(`id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `pronouns`, `phone`, `settings`, `stripe_id`, `pm_type`, `pm_last_four`, `credit_free_hours`, `credit_equipment`, `subscription`, `trial_ends_at`, `deleted_at`, `bio`, `tagline`, `looking_for_band`, `directory_visibility`, `directory_contact`, `links`) SELECT `id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `pronouns`, `phone`, `settings`, `stripe_id`, `pm_type`, `pm_last_four`, `credit_free_hours`, `credit_equipment`, `subscription`, `trial_ends_at`, `deleted_at`, `bio`, `tagline`, `looking_for_band`, `directory_visibility`, `directory_contact`, `links` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_verification`(`id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`) SELECT `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` FROM `verification`;--> statement-breakpoint
DROP TABLE `verification`;--> statement-breakpoint
ALTER TABLE `__new_verification` RENAME TO `verification`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`guard_name` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	CONSTRAINT `permissions_name_guard_unique` UNIQUE(`name`,`guard_name`)
);
--> statement-breakpoint
INSERT INTO `__new_permissions`(`id`, `name`, `guard_name`, `created_at`, `updated_at`) SELECT `id`, `name`, `guard_name`, `created_at`, `updated_at` FROM `permissions`;--> statement-breakpoint
DROP TABLE `permissions`;--> statement-breakpoint
ALTER TABLE `__new_permissions` RENAME TO `permissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`guard_name` text DEFAULT 'web' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	CONSTRAINT `roles_name_guard_unique` UNIQUE(`name`,`guard_name`)
);
--> statement-breakpoint
INSERT INTO `__new_roles`(`id`, `name`, `guard_name`, `created_at`, `updated_at`) SELECT `id`, `name`, `guard_name`, `created_at`, `updated_at` FROM `roles`;--> statement-breakpoint
DROP TABLE `roles`;--> statement-breakpoint
ALTER TABLE `__new_roles` RENAME TO `roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_credit_transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`credit_type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_credit_transaction_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_credit_transaction`(`id`, `user_id`, `credit_type`, `amount`, `balance_after`, `source`, `source_id`, `description`, `metadata`, `created_at`) SELECT `id`, `user_id`, `credit_type`, `amount`, `balance_after`, `source`, `source_id`, `description`, `metadata`, `created_at` FROM `credit_transaction`;--> statement-breakpoint
DROP TABLE `credit_transaction`;--> statement-breakpoint
ALTER TABLE `__new_credit_transaction` RENAME TO `credit_transaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payment_cache` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`reservation_id` text,
	`stripe_customer_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`paid_at` integer NOT NULL,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_payment_cache_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_payment_cache_reservation_id_reservation_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_payment_cache`(`id`, `user_id`, `reservation_id`, `stripe_customer_id`, `amount_cents`, `currency`, `payment_method`, `status`, `paid_at`, `refunded_at`, `created_at`) SELECT `id`, `user_id`, `reservation_id`, `stripe_customer_id`, `amount_cents`, `currency`, `payment_method`, `status`, `paid_at`, `refunded_at`, `created_at` FROM `payment_cache`;--> statement-breakpoint
DROP TABLE `payment_cache`;--> statement-breakpoint
ALTER TABLE `__new_payment_cache` RENAME TO `payment_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_closure` (
	`id` text PRIMARY KEY,
	`reason` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "closure_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
INSERT INTO `__new_closure`(`id`, `reason`, `starts_at`, `ends_at`, `created_at`) SELECT `id`, `reason`, `starts_at`, `ends_at`, `created_at` FROM `closure`;--> statement-breakpoint
DROP TABLE `closure`;--> statement-breakpoint
ALTER TABLE `__new_closure` RENAME TO `closure`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
INSERT INTO `__new_reservation`(`id`, `booker_type`, `booker_id`, `created_by_user_id`, `status`, `starts_at`, `ends_at`, `notes`, `cancellation_reason`, `stripe_payment_record_id`, `paid_at`, `refunded_at`, `lock_access_id`, `recurring_series_id`, `created_at`, `updated_at`) SELECT `id`, `booker_type`, `booker_id`, `created_by_user_id`, `status`, `starts_at`, `ends_at`, `notes`, `cancellation_reason`, `stripe_payment_record_id`, `paid_at`, `refunded_at`, `lock_access_id`, `recurring_series_id`, `created_at`, `updated_at` FROM `reservation`;--> statement-breakpoint
DROP TABLE `reservation`;--> statement-breakpoint
ALTER TABLE `__new_reservation` RENAME TO `reservation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_config` (
	`key` text PRIMARY KEY,
	`stripe_product_id` text,
	`name` text NOT NULL,
	`description` text,
	`unit_amount_cents` integer DEFAULT 0 NOT NULL,
	`unit_label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_product_config`(`key`, `stripe_product_id`, `name`, `description`, `unit_amount_cents`, `unit_label`, `created_at`, `updated_at`) SELECT `key`, `stripe_product_id`, `name`, `description`, `unit_amount_cents`, `unit_label`, `created_at`, `updated_at` FROM `product_config`;--> statement-breakpoint
DROP TABLE `product_config`;--> statement-breakpoint
ALTER TABLE `__new_product_config` RENAME TO `product_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`doors_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`reservation_id` text,
	`poster_key` text,
	`tags` text,
	`ticketing_enabled` integer DEFAULT false NOT NULL,
	`ticket_price` integer,
	`ticket_quantity` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_event_reservation_id_reservation_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`),
	CONSTRAINT `fk_event_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "event_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
INSERT INTO `__new_event`(`id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `created_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `created_by_user_id`, `created_at`, `updated_at` FROM `event`;--> statement-breakpoint
DROP TABLE `event`;--> statement-breakpoint
ALTER TABLE `__new_event` RENAME TO `event`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ticket` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`user_id` text,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`code` text NOT NULL UNIQUE,
	`status` text DEFAULT 'pending' NOT NULL,
	`checked_in_at` integer,
	`checked_in_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_ticket_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_ticket_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_ticket_checked_in_by_user_id_user_id_fk` FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_ticket`(`id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at` FROM `ticket`;--> statement-breakpoint
DROP TABLE `ticket`;--> statement-breakpoint
ALTER TABLE `__new_ticket` RENAME TO `ticket`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`data` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_notification`(`id`, `user_id`, `type`, `title`, `body`, `href`, `data`, `read_at`, `created_at`) SELECT `id`, `user_id`, `type`, `title`, `body`, `href`, `data`, `read_at`, `created_at` FROM `notification`;--> statement-breakpoint
DROP TABLE `notification`;--> statement-breakpoint
ALTER TABLE `__new_notification` RENAME TO `notification`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification_preference` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`notification_type` text NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`in_app_enabled` integer DEFAULT true NOT NULL,
	`sms_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_notification_preference_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `uq_notification_pref_user_type` UNIQUE(`user_id`,`notification_type`)
);
--> statement-breakpoint
INSERT INTO `__new_notification_preference`(`id`, `user_id`, `notification_type`, `email_enabled`, `in_app_enabled`, `sms_enabled`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `notification_type`, `email_enabled`, `in_app_enabled`, `sms_enabled`, `created_at`, `updated_at` FROM `notification_preference`;--> statement-breakpoint
DROP TABLE `notification_preference`;--> statement-breakpoint
ALTER TABLE `__new_notification_preference` RENAME TO `notification_preference`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_series` (
	`id` text PRIMARY KEY,
	`superseded_by` text,
	`prototype_type` text NOT NULL,
	`prototype_id` text NOT NULL,
	`rrule` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ends_at` integer,
	`cancelled_at` integer,
	CONSTRAINT `fk_recurring_series_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_recurring_series`(`id`, `superseded_by`, `prototype_type`, `prototype_id`, `rrule`, `created_at`, `ends_at`, `cancelled_at`) SELECT `id`, `superseded_by`, `prototype_type`, `prototype_id`, `rrule`, `created_at`, `ends_at`, `cancelled_at` FROM `recurring_series`;--> statement-breakpoint
DROP TABLE `recurring_series`;--> statement-breakpoint
ALTER TABLE `__new_recurring_series` RENAME TO `recurring_series`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audience` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`description` text,
	`allow_opt_in` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_audience`(`id`, `name`, `slug`, `description`, `allow_opt_in`, `created_at`) SELECT `id`, `name`, `slug`, `description`, `allow_opt_in`, `created_at` FROM `audience`;--> statement-breakpoint
DROP TABLE `audience`;--> statement-breakpoint
ALTER TABLE `__new_audience` RENAME TO `audience`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audience_member` (
	`id` text PRIMARY KEY,
	`subscriber_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_audience_member_subscriber_id_subscriber_id_fk` FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_audience_member_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE CASCADE,
	CONSTRAINT `uq_audience_member` UNIQUE(`subscriber_id`,`audience_id`)
);
--> statement-breakpoint
INSERT INTO `__new_audience_member`(`id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at`) SELECT `id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at` FROM `audience_member`;--> statement-breakpoint
DROP TABLE `audience_member`;--> statement-breakpoint
ALTER TABLE `__new_audience_member` RENAME TO `audience_member`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_campaign` (
	`id` text PRIMARY KEY,
	`subject` text NOT NULL,
	`markdown_body` text NOT NULL,
	`html_body` text NOT NULL,
	`scheduled_for` integer,
	`sent_at` integer,
	`sent_by_id` text NOT NULL,
	`recipient_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_campaign_sent_by_id_user_id_fk` FOREIGN KEY (`sent_by_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_campaign`(`id`, `subject`, `markdown_body`, `html_body`, `scheduled_for`, `sent_at`, `sent_by_id`, `recipient_count`, `created_at`, `updated_at`) SELECT `id`, `subject`, `markdown_body`, `html_body`, `scheduled_for`, `sent_at`, `sent_by_id`, `recipient_count`, `created_at`, `updated_at` FROM `campaign`;--> statement-breakpoint
DROP TABLE `campaign`;--> statement-breakpoint
ALTER TABLE `__new_campaign` RENAME TO `campaign`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_subscriber` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`name` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_subscriber_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_subscriber`(`id`, `email`, `name`, `user_id`, `created_at`) SELECT `id`, `email`, `name`, `user_id`, `created_at` FROM `subscriber`;--> statement-breakpoint
DROP TABLE `subscriber`;--> statement-breakpoint
ALTER TABLE `__new_subscriber` RENAME TO `subscriber`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_equipment` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`category_id` text NOT NULL,
	`total_quantity` integer DEFAULT 1 NOT NULL,
	`out_of_order_quantity` integer DEFAULT 0 NOT NULL,
	`serial_number` text,
	`resource_id` text,
	`condition` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`notes` text,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_equipment_category_id_equipment_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `equipment_category`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "equipment_qty_positive" CHECK(total_quantity > 0),
	CONSTRAINT "equipment_ooo_valid" CHECK(out_of_order_quantity >= 0 AND out_of_order_quantity <= total_quantity)
);
--> statement-breakpoint
INSERT INTO `__new_equipment`(`id`, `name`, `description`, `category_id`, `total_quantity`, `out_of_order_quantity`, `serial_number`, `resource_id`, `condition`, `status`, `notes`, `image_url`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `name`, `description`, `category_id`, `total_quantity`, `out_of_order_quantity`, `serial_number`, `resource_id`, `condition`, `status`, `notes`, `image_url`, `created_at`, `updated_at`, `deleted_at` FROM `equipment`;--> statement-breakpoint
DROP TABLE `equipment`;--> statement-breakpoint
ALTER TABLE `__new_equipment` RENAME TO `equipment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_equipment_category` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`display_order` integer DEFAULT 0 NOT NULL,
	`pricing_tier` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_equipment_category`(`id`, `name`, `display_order`, `pricing_tier`, `created_at`, `updated_at`) SELECT `id`, `name`, `display_order`, `pricing_tier`, `created_at`, `updated_at` FROM `equipment_category`;--> statement-breakpoint
DROP TABLE `equipment_category`;--> statement-breakpoint
ALTER TABLE `__new_equipment_category` RENAME TO `equipment_category`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_equipment_loan` (
	`id` text PRIMARY KEY,
	`equipment_id` text,
	`user_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`requested_pickup_date` integer NOT NULL,
	`estimated_return_date` integer,
	`scheduled_pickup_date` integer,
	`due_date` integer,
	`checked_out_at` integer,
	`returned_at` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`daily_rate_cents` integer,
	`estimated_cost_cents` integer,
	`total_charge_cents` integer,
	`credits_cents` integer,
	`cash_cents` integer,
	`member_notes` text,
	`staff_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_equipment_loan_equipment_id_equipment_id_fk` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_equipment_loan_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "loan_qty_positive" CHECK(quantity > 0)
);
--> statement-breakpoint
INSERT INTO `__new_equipment_loan`(`id`, `equipment_id`, `user_id`, `quantity`, `requested_pickup_date`, `estimated_return_date`, `scheduled_pickup_date`, `due_date`, `checked_out_at`, `returned_at`, `status`, `daily_rate_cents`, `estimated_cost_cents`, `total_charge_cents`, `credits_cents`, `cash_cents`, `member_notes`, `staff_notes`, `created_at`, `updated_at`) SELECT `id`, `equipment_id`, `user_id`, `quantity`, `requested_pickup_date`, `estimated_return_date`, `scheduled_pickup_date`, `due_date`, `checked_out_at`, `returned_at`, `status`, `daily_rate_cents`, `estimated_cost_cents`, `total_charge_cents`, `credits_cents`, `cash_cents`, `member_notes`, `staff_notes`, `created_at`, `updated_at` FROM `equipment_loan`;--> statement-breakpoint
DROP TABLE `equipment_loan`;--> statement-breakpoint
ALTER TABLE `__new_equipment_loan` RENAME TO `equipment_loan`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_band` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`slug` text NOT NULL,
	`bio` text,
	`owner_id` text NOT NULL,
	`avatar_key` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`tagline` text,
	`looking_for_members` integer DEFAULT false NOT NULL,
	`directory_visibility` text DEFAULT 'public' NOT NULL,
	`directory_contact` text,
	`links` text,
	CONSTRAINT `fk_band_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_band`(`id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tagline`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links`) SELECT `id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tagline`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links` FROM `band`;--> statement-breakpoint
DROP TABLE `band`;--> statement-breakpoint
ALTER TABLE `__new_band` RENAME TO `band`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_band_member` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`status` text NOT NULL,
	`invited_by_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_member_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_band_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_band_member_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `band_member_band_user_unique` UNIQUE(`band_id`,`user_id`)
);
--> statement-breakpoint
INSERT INTO `__new_band_member`(`id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at`) SELECT `id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at` FROM `band_member`;--> statement-breakpoint
DROP TABLE `band_member`;--> statement-breakpoint
ALTER TABLE `__new_band_member` RENAME TO `band_member`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_platform_invite` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`band_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`invited_by_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`accepted_at` integer,
	CONSTRAINT `fk_platform_invite_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_platform_invite_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_platform_invite`(`id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at`) SELECT `id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at` FROM `platform_invite`;--> statement-breakpoint
DROP TABLE `platform_invite`;--> statement-breakpoint
ALTER TABLE `__new_platform_invite` RENAME TO `platform_invite`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_help_articles` (
	`id` text PRIMARY KEY,
	`category_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL CONSTRAINT `help_articles_slug_unique` UNIQUE,
	`summary` text,
	`content` text NOT NULL,
	`source` text DEFAULT 'dynamic' NOT NULL,
	`min_role` text DEFAULT 'member' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_help_articles_category_id_help_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `help_categories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_help_articles_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_help_articles`(`id`, `category_id`, `title`, `slug`, `summary`, `content`, `source`, `min_role`, `published`, `sort_order`, `created_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `category_id`, `title`, `slug`, `summary`, `content`, `source`, `min_role`, `published`, `sort_order`, `created_by_user_id`, `created_at`, `updated_at` FROM `help_articles`;--> statement-breakpoint
DROP TABLE `help_articles`;--> statement-breakpoint
ALTER TABLE `__new_help_articles` RENAME TO `help_articles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_help_categories` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL CONSTRAINT `help_categories_slug_unique` UNIQUE,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`min_role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_help_categories`(`id`, `name`, `slug`, `description`, `icon`, `sort_order`, `min_role`, `created_at`, `updated_at`) SELECT `id`, `name`, `slug`, `description`, `icon`, `sort_order`, `min_role`, `created_at`, `updated_at` FROM `help_categories`;--> statement-breakpoint
DROP TABLE `help_categories`;--> statement-breakpoint
ALTER TABLE `__new_help_categories` RENAME TO `help_categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `credit_transaction_user_idx` ON `credit_transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transaction_user_type_idx` ON `credit_transaction` (`user_id`,`credit_type`);--> statement-breakpoint
CREATE INDEX `idx_payment_record_user` ON `payment_cache` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_record_reservation` ON `payment_cache` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_record_paid_at` ON `payment_cache` (`paid_at`);--> statement-breakpoint
CREATE INDEX `idx_closure_time` ON `closure` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_reservation_conflict` ON `reservation` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_reservation_user` ON `reservation` (`created_by_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reservation_booker` ON `reservation` (`booker_type`,`booker_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recurring_instance` ON `reservation` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL AND status != 'cancelled';--> statement-breakpoint
CREATE INDEX `idx_reservation_waitlist_expires` ON `reservation` (`waitlist_expires_at`) WHERE status = 'waitlisted' AND waitlist_expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_event_status_starts` ON `event` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_event_reservation` ON `event` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_event` ON `ticket` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_purchase` ON `ticket` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_user` ON `ticket` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_event_status` ON `ticket` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_notification_user` ON `notification` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_user_unread` ON `notification` (`user_id`,`read_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_pref_user` ON `notification_preference` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_recurring_series_active` ON `recurring_series` (`prototype_type`) WHERE cancelled_at IS NULL AND superseded_by IS NULL;--> statement-breakpoint
CREATE INDEX `idx_recurring_series_prototype` ON `recurring_series` (`prototype_type`,`prototype_id`);--> statement-breakpoint
CREATE INDEX `idx_audience_member_active` ON `audience_member` (`audience_id`) WHERE unsubscribed_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_campaign_pending_send` ON `campaign` (`scheduled_for`) WHERE sent_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_campaign_sent_by` ON `campaign` (`sent_by_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriber_user` ON `subscriber` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_equipment_category` ON `equipment` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_equipment_status` ON `equipment` (`status`);--> statement-breakpoint
CREATE INDEX `idx_equipment_resource_id` ON `equipment` (`resource_id`) WHERE resource_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_loan_equipment` ON `equipment_loan` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_user` ON `equipment_loan` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_status` ON `equipment_loan` (`status`);--> statement-breakpoint
CREATE INDEX `idx_band_slug` ON `band` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_band_member_user` ON `band_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_band_member_status` ON `band_member` (`status`);--> statement-breakpoint
CREATE INDEX `idx_platform_invite_email` ON `platform_invite` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_invite_band` ON `platform_invite` (`band_id`);--> statement-breakpoint
CREATE INDEX `idx_help_articles_category` ON `help_articles` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_help_articles_published` ON `help_articles` (`published`,`min_role`);