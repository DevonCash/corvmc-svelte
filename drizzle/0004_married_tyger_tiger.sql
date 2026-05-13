CREATE TABLE "product_config" (
	"key" text PRIMARY KEY NOT NULL,
	"stripe_product_id" text,
	"name" text NOT NULL,
	"description" text,
	"unit_amount_cents" integer DEFAULT 0 NOT NULL,
	"unit_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
