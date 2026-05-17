CREATE TABLE `platform_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`band_id` text NOT NULL,
	`role` text NOT NULL,
	`position` text,
	`invited_by_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`band_id`) REFERENCES `band`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_invite_token_unique` ON `platform_invite` (`token`);--> statement-breakpoint
CREATE INDEX `idx_platform_invite_email` ON `platform_invite` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_invite_band` ON `platform_invite` (`band_id`);