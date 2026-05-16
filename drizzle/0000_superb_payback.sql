CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`token` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`pronouns` text,
	`phone` text,
	`settings` text,
	`stripe_id` text,
	`pm_type` text,
	`pm_last_four` text,
	`credit_free_hours` integer DEFAULT 0 NOT NULL,
	`credit_equipment` integer DEFAULT 0 NOT NULL,
	`trial_ends_at` text,
	`deleted_at` text,
	`bio` text,
	`tagline` text,
	`looking_for_band` integer DEFAULT false NOT NULL,
	`directory_visibility` text DEFAULT 'members' NOT NULL,
	`directory_contact` text,
	`links` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_genre` (
	`user_id` text NOT NULL,
	`genre` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_genre_user` ON `user_genre` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_instrument` (
	`user_id` text NOT NULL,
	`instrument` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_instrument_user` ON `user_instrument` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	`updated_at` text DEFAULT (current_timestamp)
);
--> statement-breakpoint
CREATE TABLE `model_has_permissions` (
	`permission_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`permission_id`, `user_id`),
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_has_permissions_user_idx` ON `model_has_permissions` (`user_id`);--> statement-breakpoint
CREATE TABLE `model_has_roles` (
	`role_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`role_id`, `user_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_has_roles_user_idx` ON `model_has_roles` (`user_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`guard_name` text DEFAULT 'web' NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	`updated_at` text DEFAULT (current_timestamp)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_name_guard_unique` ON `permissions` (`name`,`guard_name`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`guard_name` text DEFAULT 'web' NOT NULL,
	`created_at` text DEFAULT (current_timestamp),
	`updated_at` text DEFAULT (current_timestamp)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_guard_unique` ON `roles` (`name`,`guard_name`);--> statement-breakpoint
CREATE TABLE `role_has_permissions` (
	`permission_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	PRIMARY KEY(`permission_id`, `role_id`),
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `band` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`owner_id` text NOT NULL,
	`avatar_key` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	`tagline` text,
	`looking_for_members` integer DEFAULT false NOT NULL,
	`directory_visibility` text DEFAULT 'public' NOT NULL,
	`directory_contact` text,
	`links` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `band_name_unique` ON `band` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `band_slug_unique` ON `band` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_band_slug` ON `band` (`slug`);--> statement-breakpoint
CREATE TABLE `band_genre` (
	`band_id` text NOT NULL,
	`genre` text NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_band_genre_band` ON `band_genre` (`band_id`);--> statement-breakpoint
CREATE TABLE `band_member` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`status` text NOT NULL,
	`invited_by_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_band_member_user` ON `band_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_band_member_status` ON `band_member` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `band_member_band_user_unique` ON `band_member` (`band_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
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
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `equipment_category`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "equipment_qty_positive" CHECK(total_quantity > 0),
	CONSTRAINT "equipment_ooo_valid" CHECK(out_of_order_quantity >= 0 AND out_of_order_quantity <= total_quantity)
);
--> statement-breakpoint
CREATE INDEX `idx_equipment_category` ON `equipment` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_equipment_status` ON `equipment` (`status`);--> statement-breakpoint
CREATE INDEX `idx_equipment_resource_id` ON `equipment` (`resource_id`) WHERE resource_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `equipment_category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`pricing_tier` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_category_name_unique` ON `equipment_category` (`name`);--> statement-breakpoint
CREATE TABLE `equipment_loan` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text,
	`user_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`requested_pickup_date` text NOT NULL,
	`scheduled_pickup_date` text,
	`due_date` text,
	`checked_out_at` text,
	`returned_at` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`daily_rate_cents` integer,
	`total_charge_cents` integer,
	`credits_cents` integer,
	`cash_cents` integer,
	`member_notes` text,
	`staff_notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "loan_qty_positive" CHECK(quantity > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_loan_equipment` ON `equipment_loan` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_user` ON `equipment_loan` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_status` ON `equipment_loan` (`status`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`doors_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`reservation_id` text,
	`poster_key` text,
	`tags` text,
	`ticketing_enabled` integer DEFAULT false NOT NULL,
	`ticket_price` integer,
	`ticket_quantity` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "event_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
CREATE INDEX `idx_event_status_starts` ON `event` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_event_reservation` ON `event` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `credit_transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`credit_type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_transaction_user_idx` ON `credit_transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transaction_user_type_idx` ON `credit_transaction` (`user_id`,`credit_type`);--> statement-breakpoint
CREATE TABLE `payment_record` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reservation_id` text,
	`stripe_customer_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`paid_at` text NOT NULL,
	`refunded_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_payment_record_user` ON `payment_record` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_record_reservation` ON `payment_record` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_record_paid_at` ON `payment_record` (`paid_at`);--> statement-breakpoint
CREATE TABLE `closure` (
	`id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT "closure_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
CREATE INDEX `idx_closure_time` ON `closure` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`booker_type` text NOT NULL,
	`booker_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`notes` text,
	`cancellation_reason` text,
	`stripe_payment_record_id` text,
	`lock_access_id` text,
	`recurring_series_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_series_id`) REFERENCES `recurring_series`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reservation_time_order" CHECK(ends_at > starts_at)
);
--> statement-breakpoint
CREATE INDEX `idx_reservation_conflict` ON `reservation` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_reservation_user` ON `reservation` (`created_by_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reservation_booker` ON `reservation` (`booker_type`,`booker_id`);--> statement-breakpoint
CREATE INDEX `idx_reservation_recurring` ON `reservation` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `product_config` (
	`key` text PRIMARY KEY NOT NULL,
	`stripe_product_id` text,
	`name` text NOT NULL,
	`description` text,
	`unit_amount_cents` integer DEFAULT 0 NOT NULL,
	`unit_label` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`user_id` text,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`checked_in_at` text,
	`checked_in_by_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_code_unique` ON `ticket` (`code`);--> statement-breakpoint
CREATE INDEX `idx_ticket_event` ON `ticket` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_purchase` ON `ticket` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_user` ON `ticket` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ticket_event_status` ON `ticket` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`data` text,
	`read_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_user` ON `notification` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notification_user_unread` ON `notification` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `notification_preference` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`notification_type` text NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`in_app_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_pref_user` ON `notification_preference` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_pref_user_type` ON `notification_preference` (`user_id`,`notification_type`);--> statement-breakpoint
CREATE TABLE `recurring_series` (
	`id` text PRIMARY KEY NOT NULL,
	`superseded_by` text,
	`prototype_type` text NOT NULL,
	`prototype_id` text NOT NULL,
	`rrule` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`cancelled_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_series_active` ON `recurring_series` (`prototype_type`) WHERE cancelled_at IS NULL AND superseded_by IS NULL;--> statement-breakpoint
CREATE INDEX `idx_recurring_series_prototype` ON `recurring_series` (`prototype_type`,`prototype_id`);--> statement-breakpoint
CREATE TABLE `audience` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`allow_opt_in` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audience_slug_unique` ON `audience` (`slug`);--> statement-breakpoint
CREATE TABLE `audience_member` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`unsubscribed_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audience_member_active` ON `audience_member` (`audience_id`) WHERE unsubscribed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_audience_member` ON `audience_member` (`subscriber_id`,`audience_id`);--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`markdown_body` text NOT NULL,
	`html_body` text NOT NULL,
	`scheduled_for` text,
	`sent_at` text,
	`sent_by_id` text NOT NULL,
	`recipient_count` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`sent_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_pending_send` ON `campaign` (`scheduled_for`) WHERE sent_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_campaign_sent_by` ON `campaign` (`sent_by_id`);--> statement-breakpoint
CREATE TABLE `campaign_audience` (
	`campaign_id` text NOT NULL,
	`audience_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `audience_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriber` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_email_unique` ON `subscriber` (`email`);--> statement-breakpoint
CREATE INDEX `idx_subscriber_user` ON `subscriber` (`user_id`);