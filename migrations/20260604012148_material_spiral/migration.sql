-- Change band.owner_id FK action from `ON DELETE SET NULL` (contradicted the
-- NOT NULL constraint) to `ON DELETE RESTRICT`. Changing an FK action requires
-- a full table rebuild. On D1 the migration runs in a transaction where
-- `PRAGMA foreign_keys=OFF` is ignored, so `DROP TABLE band` performs an
-- implicit DELETE that fires the child FK actions: every table that references
-- band(id) ON DELETE CASCADE would lose its rows, and event.band_id would be
-- nulled. To preserve data we snapshot each child table, rebuild band, then
-- restore. The DELETE-before-restore makes this correct whether or not D1
-- actually fires the cascade (idempotent: empty-then-refill).
CREATE TABLE `_bk_band_member` AS SELECT * FROM `band_member`;--> statement-breakpoint
CREATE TABLE `_bk_band_genre` AS SELECT * FROM `band_genre`;--> statement-breakpoint
CREATE TABLE `_bk_band_media` AS SELECT * FROM `band_media`;--> statement-breakpoint
CREATE TABLE `_bk_band_page_config` AS SELECT * FROM `band_page_config`;--> statement-breakpoint
CREATE TABLE `_bk_platform_invite` AS SELECT * FROM `platform_invite`;--> statement-breakpoint
CREATE TABLE `_bk_event_band` AS SELECT `id`, `band_id` FROM `event` WHERE `band_id` IS NOT NULL;--> statement-breakpoint
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
INSERT INTO `__new_band`(`id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tier`, `subscription`, `tagline`, `hometown`, `founded_year`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links`) SELECT `id`, `name`, `slug`, `bio`, `owner_id`, `avatar_key`, `created_at`, `updated_at`, `deleted_at`, `tier`, `subscription`, `tagline`, `hometown`, `founded_year`, `looking_for_members`, `directory_visibility`, `directory_contact`, `links` FROM `band`;--> statement-breakpoint
DROP TABLE `band`;--> statement-breakpoint
ALTER TABLE `__new_band` RENAME TO `band`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_band_slug` ON `band` (`slug`);--> statement-breakpoint
-- Restore child rows (empty-then-refill so it is correct whether or not the
-- DROP TABLE above cascaded the children away).
DELETE FROM `band_member`;--> statement-breakpoint
INSERT INTO `band_member` SELECT * FROM `_bk_band_member`;--> statement-breakpoint
DELETE FROM `band_genre`;--> statement-breakpoint
INSERT INTO `band_genre` SELECT * FROM `_bk_band_genre`;--> statement-breakpoint
DELETE FROM `band_media`;--> statement-breakpoint
INSERT INTO `band_media` SELECT * FROM `_bk_band_media`;--> statement-breakpoint
DELETE FROM `band_page_config`;--> statement-breakpoint
INSERT INTO `band_page_config` SELECT * FROM `_bk_band_page_config`;--> statement-breakpoint
DELETE FROM `platform_invite`;--> statement-breakpoint
INSERT INTO `platform_invite` SELECT * FROM `_bk_platform_invite`;--> statement-breakpoint
UPDATE `event` SET `band_id` = (SELECT `band_id` FROM `_bk_event_band` WHERE `_bk_event_band`.`id` = `event`.`id`) WHERE `id` IN (SELECT `id` FROM `_bk_event_band`);--> statement-breakpoint
DROP TABLE `_bk_band_member`;--> statement-breakpoint
DROP TABLE `_bk_band_genre`;--> statement-breakpoint
DROP TABLE `_bk_band_media`;--> statement-breakpoint
DROP TABLE `_bk_band_page_config`;--> statement-breakpoint
DROP TABLE `_bk_platform_invite`;--> statement-breakpoint
DROP TABLE `_bk_event_band`;
