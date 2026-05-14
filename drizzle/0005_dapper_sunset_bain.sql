CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"doors_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"reservation_id" uuid,
	"poster_key" text,
	"tags" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_time_order" CHECK (ends_at > starts_at)
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_status_starts" ON "event" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "idx_event_reservation" ON "event" USING btree ("reservation_id");