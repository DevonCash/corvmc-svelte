CREATE TABLE "recurring_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"superseded_by" uuid,
	"prototype_type" text NOT NULL,
	"prototype_id" text NOT NULL,
	"rrule" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reservation" ADD COLUMN "recurring_series_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_recurring_series_active" ON "recurring_series" USING btree ("prototype_type") WHERE cancelled_at IS NULL AND superseded_by IS NULL;--> statement-breakpoint
CREATE INDEX "idx_recurring_series_prototype" ON "recurring_series" USING btree ("prototype_type","prototype_id");--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_recurring_series_id_recurring_series_id_fk" FOREIGN KEY ("recurring_series_id") REFERENCES "public"."recurring_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reservation_recurring" ON "reservation" USING btree ("recurring_series_id","starts_at") WHERE recurring_series_id IS NOT NULL;