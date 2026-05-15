CREATE TABLE "audience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"allow_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audience_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audience_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"audience_id" uuid NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_audience_member" UNIQUE("subscriber_id","audience_id")
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"markdown_body" text NOT NULL,
	"html_body" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"sent_by_id" text NOT NULL,
	"recipient_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_audience" (
	"campaign_id" uuid NOT NULL,
	"audience_id" uuid NOT NULL,
	CONSTRAINT "campaign_audience_campaign_id_audience_id_pk" PRIMARY KEY("campaign_id","audience_id")
);
--> statement-breakpoint
CREATE TABLE "subscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriber_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audience_member" ADD CONSTRAINT "audience_member_subscriber_id_subscriber_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscriber"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_member" ADD CONSTRAINT "audience_member_audience_id_audience_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_sent_by_id_user_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_audience" ADD CONSTRAINT "campaign_audience_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_audience" ADD CONSTRAINT "campaign_audience_audience_id_audience_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriber" ADD CONSTRAINT "subscriber_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audience_member_active" ON "audience_member" USING btree ("audience_id") WHERE unsubscribed_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_campaign_pending_send" ON "campaign" USING btree ("scheduled_for") WHERE sent_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_campaign_sent_by" ON "campaign" USING btree ("sent_by_id");--> statement-breakpoint
CREATE INDEX "idx_subscriber_user" ON "subscriber" USING btree ("user_id");