CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid NOT NULL,
	"total_quantity" integer DEFAULT 1 NOT NULL,
	"out_of_order_quantity" integer DEFAULT 0 NOT NULL,
	"serial_number" text,
	"resource_id" text,
	"condition" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"notes" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "equipment_qty_positive" CHECK (total_quantity > 0),
	CONSTRAINT "equipment_ooo_valid" CHECK (out_of_order_quantity >= 0 AND out_of_order_quantity <= total_quantity)
);
--> statement-breakpoint
CREATE TABLE "equipment_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"pricing_tier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "equipment_loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" uuid,
	"user_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"requested_pickup_date" timestamp with time zone NOT NULL,
	"scheduled_pickup_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"checked_out_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"status" text DEFAULT 'requested' NOT NULL,
	"daily_rate_cents" integer,
	"total_charge_cents" integer,
	"credits_cents" integer,
	"cash_cents" integer,
	"member_notes" text,
	"staff_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_qty_positive" CHECK (quantity > 0)
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_category_id_equipment_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_loan" ADD CONSTRAINT "equipment_loan_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_loan" ADD CONSTRAINT "equipment_loan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_equipment_category" ON "equipment" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_status" ON "equipment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_equipment_resource_id" ON "equipment" USING btree ("resource_id") WHERE resource_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_loan_equipment" ON "equipment_loan" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "idx_loan_user" ON "equipment_loan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_loan_status" ON "equipment_loan" USING btree ("status");