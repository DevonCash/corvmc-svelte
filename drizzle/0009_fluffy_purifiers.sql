CREATE TABLE "payment_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reservation_id" uuid,
	"stripe_customer_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_record_user" ON "payment_record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_record_reservation" ON "payment_record" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_payment_record_paid_at" ON "payment_record" USING btree ("paid_at");