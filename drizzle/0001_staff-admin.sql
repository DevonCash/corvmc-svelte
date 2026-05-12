ALTER TABLE "model_has_permissions" RENAME COLUMN "model_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "model_has_roles" RENAME COLUMN "model_id" TO "user_id";--> statement-breakpoint
DROP INDEX "model_has_permissions_model_idx";--> statement-breakpoint
DROP INDEX "model_has_roles_model_idx";--> statement-breakpoint
ALTER TABLE "model_has_permissions" DROP CONSTRAINT "model_has_permissions_permission_id_model_id_model_type_pk";--> statement-breakpoint
ALTER TABLE "model_has_roles" DROP CONSTRAINT "model_has_roles_role_id_model_id_model_type_pk";--> statement-breakpoint
ALTER TABLE "model_has_permissions" ADD CONSTRAINT "model_has_permissions_permission_id_user_id_pk" PRIMARY KEY("permission_id","user_id");--> statement-breakpoint
ALTER TABLE "model_has_roles" ADD CONSTRAINT "model_has_roles_role_id_user_id_pk" PRIMARY KEY("role_id","user_id");--> statement-breakpoint
ALTER TABLE "model_has_permissions" ADD CONSTRAINT "model_has_permissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_has_roles" ADD CONSTRAINT "model_has_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_has_permissions_user_idx" ON "model_has_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "model_has_roles_user_idx" ON "model_has_roles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "model_has_permissions" DROP COLUMN "model_type";--> statement-breakpoint
ALTER TABLE "model_has_roles" DROP COLUMN "model_type";