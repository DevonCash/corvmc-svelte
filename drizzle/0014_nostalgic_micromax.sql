ALTER TABLE "user" ADD COLUMN "directory_visibility" text DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "directory_visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "directory_opt_out";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "public_listing";--> statement-breakpoint
ALTER TABLE "band" DROP COLUMN "directory_opt_out";--> statement-breakpoint
ALTER TABLE "band" DROP COLUMN "public_listing";