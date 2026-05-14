CREATE TABLE "band" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"owner_id" text NOT NULL,
	"avatar_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "band_name_unique" UNIQUE("name"),
	CONSTRAINT "band_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "band_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"position" text,
	"status" text NOT NULL,
	"invited_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "band_member_band_user_unique" UNIQUE("band_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "band" ADD CONSTRAINT "band_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_member" ADD CONSTRAINT "band_member_band_id_band_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."band"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_member" ADD CONSTRAINT "band_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_member" ADD CONSTRAINT "band_member_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_band_slug" ON "band" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_band_member_user" ON "band_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_band_member_status" ON "band_member" USING btree ("status");