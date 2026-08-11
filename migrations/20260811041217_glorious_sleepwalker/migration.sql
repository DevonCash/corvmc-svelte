-- d1-safe-rebuild: rewritten for Cloudflare D1.
-- D1 ignores PRAGMA foreign_keys=OFF inside its migration transaction, so
-- drizzle's generated DROP TABLE would cascade-delete these children:
--   audience_member, campaign_audience
-- Each is rebuilt with its FK demoted to NO ACTION, then restored below.
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
-- detach audience_member
CREATE TABLE `__detach_audience_member` (
	`id` text PRIMARY KEY,
	`subscriber_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `uq_audience_member` UNIQUE(`subscriber_id`,`audience_id`),
	CONSTRAINT `fk_audience_member_subscriber_id_subscriber_id_fk` FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_audience_member_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`)
);
--> statement-breakpoint
INSERT INTO `__detach_audience_member`(`id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at`) SELECT `id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at` FROM `audience_member`;
--> statement-breakpoint
DROP TABLE `audience_member`;
--> statement-breakpoint
ALTER TABLE `__detach_audience_member` RENAME TO `audience_member`;
--> statement-breakpoint
CREATE INDEX `idx_audience_member_active` ON `audience_member` (`audience_id`) WHERE unsubscribed_at IS NULL;
--> statement-breakpoint
-- detach campaign_audience
CREATE TABLE `__detach_campaign_audience` (
	`campaign_id` text NOT NULL,
	`audience_id` text NOT NULL,
	CONSTRAINT `campaign_audience_pk` PRIMARY KEY(`campaign_id`, `audience_id`),
	CONSTRAINT `fk_campaign_audience_campaign_id_campaign_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_campaign_audience_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`)
);
--> statement-breakpoint
INSERT INTO `__detach_campaign_audience`(`campaign_id`, `audience_id`) SELECT `campaign_id`, `audience_id` FROM `campaign_audience`;
--> statement-breakpoint
DROP TABLE `campaign_audience`;
--> statement-breakpoint
ALTER TABLE `__detach_campaign_audience` RENAME TO `campaign_audience`;
--> statement-breakpoint
ALTER TABLE `audience` ADD `system_key` text;
--> statement-breakpoint
CREATE TABLE `__new_audience` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`description` text,
	`allow_opt_in` integer DEFAULT false NOT NULL,
	`system_key` text UNIQUE,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_audience`(`id`, `name`, `slug`, `description`, `allow_opt_in`, `created_at`) SELECT `id`, `name`, `slug`, `description`, `allow_opt_in`, `created_at` FROM `audience`;
--> statement-breakpoint
DROP TABLE `audience`;
--> statement-breakpoint
ALTER TABLE `__new_audience` RENAME TO `audience`;
--> statement-breakpoint
-- reattach campaign_audience
CREATE TABLE `__reattach_campaign_audience` (
	`campaign_id` text NOT NULL,
	`audience_id` text NOT NULL,
	CONSTRAINT `campaign_audience_pk` PRIMARY KEY(`campaign_id`, `audience_id`),
	CONSTRAINT `fk_campaign_audience_campaign_id_campaign_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_campaign_audience_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_campaign_audience`(`campaign_id`, `audience_id`) SELECT `campaign_id`, `audience_id` FROM `campaign_audience`;
--> statement-breakpoint
DROP TABLE `campaign_audience`;
--> statement-breakpoint
ALTER TABLE `__reattach_campaign_audience` RENAME TO `campaign_audience`;
--> statement-breakpoint
-- reattach audience_member
CREATE TABLE `__reattach_audience_member` (
	`id` text PRIMARY KEY,
	`subscriber_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `uq_audience_member` UNIQUE(`subscriber_id`,`audience_id`),
	CONSTRAINT `fk_audience_member_subscriber_id_subscriber_id_fk` FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_audience_member_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__reattach_audience_member`(`id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at`) SELECT `id`, `subscriber_id`, `audience_id`, `unsubscribed_at`, `created_at` FROM `audience_member`;
--> statement-breakpoint
DROP TABLE `audience_member`;
--> statement-breakpoint
ALTER TABLE `__reattach_audience_member` RENAME TO `audience_member`;
--> statement-breakpoint
CREATE INDEX `idx_audience_member_active` ON `audience_member` (`audience_id`) WHERE unsubscribed_at IS NULL;
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
