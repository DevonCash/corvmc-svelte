ALTER TABLE "user" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "instruments" text[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "genres" text[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "looking_for_band" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "directory_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "public_listing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "directory_contact" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "links" jsonb;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "genres" text[];--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "looking_for_members" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "directory_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "public_listing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "directory_contact" jsonb;--> statement-breakpoint
ALTER TABLE "band" ADD COLUMN "links" jsonb;--> statement-breakpoint
CREATE INDEX "idx_user_instruments" ON "user" USING gin ("instruments");--> statement-breakpoint
CREATE INDEX "idx_user_genres" ON "user" USING gin ("genres");--> statement-breakpoint
CREATE INDEX "idx_band_genres" ON "band" USING gin ("genres");