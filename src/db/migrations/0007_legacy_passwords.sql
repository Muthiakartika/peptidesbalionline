CREATE TABLE "legacy_passwords" (
	"user_id" text PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legacy_passwords" ADD CONSTRAINT "legacy_passwords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;