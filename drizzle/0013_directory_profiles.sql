-- User profile columns for directory
ALTER TABLE "user" ADD COLUMN "bio" text;
ALTER TABLE "user" ADD COLUMN "tagline" text;
ALTER TABLE "user" ADD COLUMN "instruments" text[];
ALTER TABLE "user" ADD COLUMN "genres" text[];
ALTER TABLE "user" ADD COLUMN "looking_for_band" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "directory_opt_out" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "public_listing" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "directory_contact" jsonb;
ALTER TABLE "user" ADD COLUMN "links" jsonb;

-- Band profile columns for directory
ALTER TABLE "band" ADD COLUMN "tagline" text;
ALTER TABLE "band" ADD COLUMN "genres" text[];
ALTER TABLE "band" ADD COLUMN "looking_for_members" boolean NOT NULL DEFAULT false;
ALTER TABLE "band" ADD COLUMN "directory_opt_out" boolean NOT NULL DEFAULT false;
ALTER TABLE "band" ADD COLUMN "public_listing" boolean NOT NULL DEFAULT false;
ALTER TABLE "band" ADD COLUMN "directory_contact" jsonb;
ALTER TABLE "band" ADD COLUMN "links" jsonb;

-- GIN indexes for array overlap filtering
CREATE INDEX "idx_user_instruments" ON "user" USING gin ("instruments");
CREATE INDEX "idx_user_genres" ON "user" USING gin ("genres");
CREATE INDEX "idx_band_genres" ON "band" USING gin ("genres");
