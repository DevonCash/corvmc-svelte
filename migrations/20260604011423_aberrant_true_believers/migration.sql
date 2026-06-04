ALTER TABLE `user` ADD `member_number` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `hometown` text;--> statement-breakpoint
ALTER TABLE `band` ADD `hometown` text;--> statement-breakpoint
ALTER TABLE `band` ADD `founded_year` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_member_number_unique` ON `user` (`member_number`);