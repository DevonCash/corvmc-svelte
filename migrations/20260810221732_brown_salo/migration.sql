-- d1-safe-rebuild: rewritten for Cloudflare D1.
--> statement-breakpoint
-- D1 ignores PRAGMA foreign_keys=OFF inside its migration transaction, so
--> statement-breakpoint
-- drizzle's generated DROP TABLE would cascade-delete these children:
--> statement-breakpoint
--   ticket, event_rsvp, event, band_genre, band_member, band_media, band_page_config, platform_invite
--> statement-breakpoint
-- Each is rebuilt with its FK demoted to NO ACTION, then restored below.
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
-- detach ticket
--> statement-breakpoint
CREATE TABLE `__detach_ticket` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`user_id` text,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_payment_record_id` text,
	`checked_in_at` integer,
	`checked_in_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `ticket_code_unique` UNIQUE(`code`),
	CONSTRAINT `fk_ticket_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`),
	CONSTRAINT `fk_ticket_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_ticket_checked_in_by_user_id_user_id_fk` FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__detach_ticket`(`id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `stripe_payment_record_id`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `stripe_payment_record_id`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at` FROM `ticket`;
--> statement-breakpoint
DROP TABLE `ticket`;
--> statement-breakpoint
ALTER TABLE `__detach_ticket` RENAME TO `ticket`;
--> statement-breakpoint
CREATE INDEX `idx_ticket_event` ON `ticket` (`event_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_purchase` ON `ticket` (`purchase_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_user` ON `ticket` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_event_status` ON `ticket` (`event_id`,`status`);
--> statement-breakpoint
-- detach event_rsvp
--> statement-breakpoint
CREATE TABLE `__detach_event_rsvp` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_event_rsvp_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`),
	CONSTRAINT `fk_event_rsvp_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__detach_event_rsvp`(`id`, `event_id`, `user_id`, `attendee_name`, `attendee_email`, `created_at`) SELECT `id`, `event_id`, `user_id`, `attendee_name`, `attendee_email`, `created_at` FROM `event_rsvp`;
--> statement-breakpoint
DROP TABLE `event_rsvp`;
--> statement-breakpoint
ALTER TABLE `__detach_event_rsvp` RENAME TO `event_rsvp`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_event_rsvp_event_user` ON `event_rsvp` (`event_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_rsvp_event` ON `event_rsvp` (`event_id`);
--> statement-breakpoint
-- detach event
--> statement-breakpoint
CREATE TABLE `__detach_event` (
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
	`band_id` text,
	`source` text DEFAULT 'cmc' NOT NULL,
	`location` text,
	`external_ticket_url` text,
	`recurring_series_id` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_event_reservation_id_reservation_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`),
	CONSTRAINT `fk_event_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`),
	CONSTRAINT `fk_event_recurring_series_id_recurring_series_id_fk` FOREIGN KEY (`recurring_series_id`) REFERENCES `recurring_series`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_event_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `event_time_order` CHECK(ends_at > starts_at)
);
--> statement-breakpoint
INSERT INTO `__detach_event`(`id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `band_id`, `source`, `location`, `external_ticket_url`, `recurring_series_id`, `created_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `band_id`, `source`, `location`, `external_ticket_url`, `recurring_series_id`, `created_by_user_id`, `created_at`, `updated_at` FROM `event`;
--> statement-breakpoint
DROP TABLE `event`;
--> statement-breakpoint
ALTER TABLE `__detach_event` RENAME TO `event`;
--> statement-breakpoint
CREATE INDEX `idx_event_status_starts` ON `event` (`status`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `idx_event_reservation` ON `event` (`reservation_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_band` ON `event` (`band_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_source` ON `event` (`source`,`status`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `idx_event_recurring_series` ON `event` (`recurring_series_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_event_recurring_instance` ON `event` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL AND status != 'cancelled';
--> statement-breakpoint
-- detach band_genre
--> statement-breakpoint
CREATE TABLE `__detach_band_genre` (
	`band_id` text NOT NULL,
	`genre` text NOT NULL,
	CONSTRAINT `fk_band_genre_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`)
);
--> statement-breakpoint
INSERT INTO `__detach_band_genre`(`band_id`, `genre`) SELECT `band_id`, `genre` FROM `band_genre`;
--> statement-breakpoint
DROP TABLE `band_genre`;
--> statement-breakpoint
ALTER TABLE `__detach_band_genre` RENAME TO `band_genre`;
--> statement-breakpoint
CREATE INDEX `idx_band_genre_band` ON `band_genre` (`band_id`);
--> statement-breakpoint
-- detach band_member
--> statement-breakpoint
CREATE TABLE `__detach_band_member` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`status` text NOT NULL,
	`invited_by_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `band_member_band_user_unique` UNIQUE(`band_id`,`user_id`),
	CONSTRAINT `fk_band_member_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`),
	CONSTRAINT `fk_band_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_band_member_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__detach_band_member`(`id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at`) SELECT `id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at` FROM `band_member`;
--> statement-breakpoint
DROP TABLE `band_member`;
--> statement-breakpoint
ALTER TABLE `__detach_band_member` RENAME TO `band_member`;
--> statement-breakpoint
CREATE INDEX `idx_band_member_user` ON `band_member` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_band_member_status` ON `band_member` (`status`);
--> statement-breakpoint
-- detach band_media
--> statement-breakpoint
CREATE TABLE `__detach_band_media` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_media_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`)
);
--> statement-breakpoint
INSERT INTO `__detach_band_media`(`id`, `band_id`, `key`, `type`, `caption`, `sort_order`, `created_at`) SELECT `id`, `band_id`, `key`, `type`, `caption`, `sort_order`, `created_at` FROM `band_media`;
--> statement-breakpoint
DROP TABLE `band_media`;
--> statement-breakpoint
ALTER TABLE `__detach_band_media` RENAME TO `band_media`;
--> statement-breakpoint
CREATE INDEX `idx_band_media_band_type` ON `band_media` (`band_id`,`type`,`sort_order`);
--> statement-breakpoint
-- detach band_page_config
--> statement-breakpoint
CREATE TABLE `__detach_band_page_config` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`theme` text DEFAULT 'default' NOT NULL,
	`custom_css` text,
	`blocks` text DEFAULT '[]' NOT NULL,
	`epk` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_page_config_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`)
);
--> statement-breakpoint
INSERT INTO `__detach_band_page_config`(`id`, `band_id`, `theme`, `custom_css`, `blocks`, `epk`, `updated_at`) SELECT `id`, `band_id`, `theme`, `custom_css`, `blocks`, `epk`, `updated_at` FROM `band_page_config`;
--> statement-breakpoint
DROP TABLE `band_page_config`;
--> statement-breakpoint
ALTER TABLE `__detach_band_page_config` RENAME TO `band_page_config`;
--> statement-breakpoint
CREATE INDEX `idx_band_page_config_band` ON `band_page_config` (`band_id`);
--> statement-breakpoint
-- detach platform_invite
--> statement-breakpoint
CREATE TABLE `__detach_platform_invite` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`band_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`invited_by_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`accepted_at` integer,
	CONSTRAINT `platform_invite_token_unique` UNIQUE(`token`),
	CONSTRAINT `fk_platform_invite_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`),
	CONSTRAINT `fk_platform_invite_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__detach_platform_invite`(`id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at`) SELECT `id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at` FROM `platform_invite`;
--> statement-breakpoint
DROP TABLE `platform_invite`;
--> statement-breakpoint
ALTER TABLE `__detach_platform_invite` RENAME TO `platform_invite`;
--> statement-breakpoint
CREATE INDEX `idx_platform_invite_email` ON `platform_invite` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_platform_invite_band` ON `platform_invite` (`band_id`);
--> statement-breakpoint
CREATE TABLE `__new_band` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`owner_id` text NOT NULL,
	`avatar_key` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`tier` text DEFAULT 'free' NOT NULL,
	`subscription` text,
	`tagline` text,
	`hometown` text,
	`founded_year` text,
	`looking_for_members` integer DEFAULT false NOT NULL,
	`directory_visibility` text DEFAULT 'public' NOT NULL,
	`directory_contact` text,
	`links` text,
	CONSTRAINT `fk_band_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
INSERT INTO `__new_band`(`id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tier`, `subscription`, `tagline`, `hometown`, `founded_year`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links`) SELECT `id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tier`, `subscription`, `tagline`, `hometown`, `founded_year`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links` FROM `band`;
--> statement-breakpoint
DROP TABLE `band`;
--> statement-breakpoint
ALTER TABLE `__new_band` RENAME TO `band`;
--> statement-breakpoint
CREATE INDEX `idx_band_slug` ON `band` (`slug`);
--> statement-breakpoint
-- reattach platform_invite
--> statement-breakpoint
CREATE TABLE `__reattach_platform_invite` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`band_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`invited_by_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`accepted_at` integer,
	CONSTRAINT `platform_invite_token_unique` UNIQUE(`token`),
	CONSTRAINT `fk_platform_invite_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_platform_invite_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__reattach_platform_invite`(`id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at`) SELECT `id`, `email`, `token`, `band_id`, `role`, `position`, `invited_by_id`, `status`, `expires_at`, `created_at`, `accepted_at` FROM `platform_invite`;
--> statement-breakpoint
DROP TABLE `platform_invite`;
--> statement-breakpoint
ALTER TABLE `__reattach_platform_invite` RENAME TO `platform_invite`;
--> statement-breakpoint
CREATE INDEX `idx_platform_invite_email` ON `platform_invite` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_platform_invite_band` ON `platform_invite` (`band_id`);
--> statement-breakpoint
-- reattach band_page_config
--> statement-breakpoint
CREATE TABLE `__reattach_band_page_config` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`theme` text DEFAULT 'default' NOT NULL,
	`custom_css` text,
	`blocks` text DEFAULT '[]' NOT NULL,
	`epk` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_page_config_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_band_page_config`(`id`, `band_id`, `theme`, `custom_css`, `blocks`, `epk`, `updated_at`) SELECT `id`, `band_id`, `theme`, `custom_css`, `blocks`, `epk`, `updated_at` FROM `band_page_config`;
--> statement-breakpoint
DROP TABLE `band_page_config`;
--> statement-breakpoint
ALTER TABLE `__reattach_band_page_config` RENAME TO `band_page_config`;
--> statement-breakpoint
CREATE INDEX `idx_band_page_config_band` ON `band_page_config` (`band_id`);
--> statement-breakpoint
-- reattach band_media
--> statement-breakpoint
CREATE TABLE `__reattach_band_media` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_band_media_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_band_media`(`id`, `band_id`, `key`, `type`, `caption`, `sort_order`, `created_at`) SELECT `id`, `band_id`, `key`, `type`, `caption`, `sort_order`, `created_at` FROM `band_media`;
--> statement-breakpoint
DROP TABLE `band_media`;
--> statement-breakpoint
ALTER TABLE `__reattach_band_media` RENAME TO `band_media`;
--> statement-breakpoint
CREATE INDEX `idx_band_media_band_type` ON `band_media` (`band_id`,`type`,`sort_order`);
--> statement-breakpoint
-- reattach band_member
--> statement-breakpoint
CREATE TABLE `__reattach_band_member` (
	`id` text PRIMARY KEY,
	`band_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`status` text NOT NULL,
	`invited_by_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `band_member_band_user_unique` UNIQUE(`band_id`,`user_id`),
	CONSTRAINT `fk_band_member_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_band_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_band_member_invited_by_id_user_id_fk` FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__reattach_band_member`(`id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at`) SELECT `id`, `band_id`, `user_id`, `role`, `position`, `status`, `invited_by_id`, `created_at` FROM `band_member`;
--> statement-breakpoint
DROP TABLE `band_member`;
--> statement-breakpoint
ALTER TABLE `__reattach_band_member` RENAME TO `band_member`;
--> statement-breakpoint
CREATE INDEX `idx_band_member_user` ON `band_member` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_band_member_status` ON `band_member` (`status`);
--> statement-breakpoint
-- reattach band_genre
--> statement-breakpoint
CREATE TABLE `__reattach_band_genre` (
	`band_id` text NOT NULL,
	`genre` text NOT NULL,
	CONSTRAINT `fk_band_genre_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_band_genre`(`band_id`, `genre`) SELECT `band_id`, `genre` FROM `band_genre`;
--> statement-breakpoint
DROP TABLE `band_genre`;
--> statement-breakpoint
ALTER TABLE `__reattach_band_genre` RENAME TO `band_genre`;
--> statement-breakpoint
CREATE INDEX `idx_band_genre_band` ON `band_genre` (`band_id`);
--> statement-breakpoint
-- reattach event
--> statement-breakpoint
CREATE TABLE `__reattach_event` (
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
	`band_id` text,
	`source` text DEFAULT 'cmc' NOT NULL,
	`location` text,
	`external_ticket_url` text,
	`recurring_series_id` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_event_reservation_id_reservation_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`),
	CONSTRAINT `fk_event_band_id_band_id_fk` FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_event_recurring_series_id_recurring_series_id_fk` FOREIGN KEY (`recurring_series_id`) REFERENCES `recurring_series`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_event_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `event_time_order` CHECK(ends_at > starts_at)
);
--> statement-breakpoint
INSERT INTO `__reattach_event`(`id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `band_id`, `source`, `location`, `external_ticket_url`, `recurring_series_id`, `created_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `title`, `description`, `starts_at`, `ends_at`, `doors_at`, `status`, `published_at`, `reservation_id`, `poster_key`, `tags`, `ticketing_enabled`, `ticket_price`, `ticket_quantity`, `band_id`, `source`, `location`, `external_ticket_url`, `recurring_series_id`, `created_by_user_id`, `created_at`, `updated_at` FROM `event`;
--> statement-breakpoint
DROP TABLE `event`;
--> statement-breakpoint
ALTER TABLE `__reattach_event` RENAME TO `event`;
--> statement-breakpoint
CREATE INDEX `idx_event_status_starts` ON `event` (`status`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `idx_event_reservation` ON `event` (`reservation_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_band` ON `event` (`band_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_source` ON `event` (`source`,`status`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `idx_event_recurring_series` ON `event` (`recurring_series_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_event_recurring_instance` ON `event` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL AND status != 'cancelled';
--> statement-breakpoint
-- reattach event_rsvp
--> statement-breakpoint
CREATE TABLE `__reattach_event_rsvp` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_event_rsvp_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_rsvp_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_event_rsvp`(`id`, `event_id`, `user_id`, `attendee_name`, `attendee_email`, `created_at`) SELECT `id`, `event_id`, `user_id`, `attendee_name`, `attendee_email`, `created_at` FROM `event_rsvp`;
--> statement-breakpoint
DROP TABLE `event_rsvp`;
--> statement-breakpoint
ALTER TABLE `__reattach_event_rsvp` RENAME TO `event_rsvp`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_event_rsvp_event_user` ON `event_rsvp` (`event_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_event_rsvp_event` ON `event_rsvp` (`event_id`);
--> statement-breakpoint
-- reattach ticket
--> statement-breakpoint
CREATE TABLE `__reattach_ticket` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`user_id` text,
	`attendee_name` text NOT NULL,
	`attendee_email` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_payment_record_id` text,
	`checked_in_at` integer,
	`checked_in_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `ticket_code_unique` UNIQUE(`code`),
	CONSTRAINT `fk_ticket_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_ticket_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_ticket_checked_in_by_user_id_user_id_fk` FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__reattach_ticket`(`id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `stripe_payment_record_id`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `event_id`, `purchase_id`, `user_id`, `attendee_name`, `attendee_email`, `code`, `status`, `stripe_payment_record_id`, `checked_in_at`, `checked_in_by_user_id`, `created_at`, `updated_at` FROM `ticket`;
--> statement-breakpoint
DROP TABLE `ticket`;
--> statement-breakpoint
ALTER TABLE `__reattach_ticket` RENAME TO `ticket`;
--> statement-breakpoint
CREATE INDEX `idx_ticket_event` ON `ticket` (`event_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_purchase` ON `ticket` (`purchase_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_user` ON `ticket` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_event_status` ON `ticket` (`event_id`,`status`);
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
