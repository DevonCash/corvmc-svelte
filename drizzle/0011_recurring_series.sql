-- recurring_series table
CREATE TABLE IF NOT EXISTS "recurring_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"superseded_by" uuid,
	"prototype_type" text NOT NULL,
	"prototype_id" text NOT NULL,
	"rrule" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint

-- Self-referential FK (Drizzle can't express same-table references inline)
ALTER TABLE "recurring_series"
	ADD CONSTRAINT "recurring_series_superseded_by_fk"
	FOREIGN KEY ("superseded_by") REFERENCES "recurring_series"("id")
	ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Partial index: active series (not cancelled, not superseded)
CREATE INDEX IF NOT EXISTS "idx_recurring_series_active"
	ON "recurring_series" ("prototype_type")
	WHERE cancelled_at IS NULL AND superseded_by IS NULL;
--> statement-breakpoint

-- Prototype lookup index
CREATE INDEX IF NOT EXISTS "idx_recurring_series_prototype"
	ON "recurring_series" ("prototype_type", "prototype_id");
--> statement-breakpoint

-- Add recurring_series_id to reservation
ALTER TABLE "reservation"
	ADD COLUMN "recurring_series_id" uuid;
--> statement-breakpoint

ALTER TABLE "reservation"
	ADD CONSTRAINT "reservation_recurring_series_id_recurring_series_id_fk"
	FOREIGN KEY ("recurring_series_id") REFERENCES "recurring_series"("id")
	ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Partial index on reservation for recurring lookups
CREATE INDEX IF NOT EXISTS "idx_reservation_recurring"
	ON "reservation" ("recurring_series_id", "starts_at")
	WHERE recurring_series_id IS NOT NULL;
