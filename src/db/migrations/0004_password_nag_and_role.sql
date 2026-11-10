ALTER TABLE "users" ADD COLUMN "temporary_password" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "set_password_resent_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'customer';