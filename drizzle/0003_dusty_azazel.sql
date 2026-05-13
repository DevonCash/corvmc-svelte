CREATE TABLE "closure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closure_time_order" CHECK (ends_at > starts_at)
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booker_type" text NOT NULL,
	"booker_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text,
	"cancellation_reason" text,
	"stripe_payment_record_id" text,
	"lock_access_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_time_order" CHECK (ends_at > starts_at)
);
--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_closure_time" ON "closure" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_reservation_conflict" ON "reservation" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_reservation_user" ON "reservation" USING btree ("created_by_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_reservation_booker" ON "reservation" USING btree ("booker_type","booker_id");