CREATE TYPE "public"."affiliate_commission_entry" AS ENUM('earn', 'reversal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."affiliate_referral_status" AS ENUM('pending', 'unpaid', 'paid', 'rejected', 'draft');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'inactive', 'pending', 'rejected');--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"entry_type" "affiliate_commission_entry" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_affwp_customer_id" integer,
	"user_id" text,
	"email" text,
	"first_name" text,
	"last_name" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout_items" (
	"payout_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	CONSTRAINT "affiliate_payout_items_payout_id_referral_id_pk" PRIMARY KEY("payout_id","referral_id")
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_affwp_payout_id" integer,
	"affiliate_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"method" text,
	"status" "affiliate_payout_status" DEFAULT 'processing' NOT NULL,
	"paid_at" timestamp with time zone,
	"reference" text,
	"owner_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_affwp_referral_id" integer,
	"affiliate_id" uuid NOT NULL,
	"order_id" uuid,
	"visit_id" uuid,
	"affiliate_customer_id" uuid,
	"payout_id" uuid,
	"parent_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'IDR' NOT NULL,
	"status" "affiliate_referral_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"reference" text,
	"context" text,
	"campaign" text,
	"type" text DEFAULT 'sale' NOT NULL,
	"flag" text,
	"products" jsonb,
	"custom" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"source" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_affwp_visit_id" integer,
	"affiliate_id" uuid NOT NULL,
	"referral_id" uuid,
	"url" text,
	"referrer" text,
	"campaign" text,
	"context" text,
	"flag" text,
	"ip_hash" text,
	"landed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"legacy_affwp_affiliate_id" integer,
	"username_slug" text,
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"rate" text,
	"rate_type" text,
	"flat_rate_basis" text,
	"payment_email" text,
	"website_url" text,
	"promotion_method" text,
	"date_registered" timestamp with time zone,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"legacy_totals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "used_by" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "order_notes" ADD COLUMN "legacy_wc_note_id" integer;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_customers" ADD CONSTRAINT "affiliate_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_payout_id_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_visit_id_affiliate_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."affiliate_visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_customer_id_affiliate_customers_id_fk" FOREIGN KEY ("affiliate_customer_id") REFERENCES "public"."affiliate_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_payout_id_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_settings" ADD CONSTRAINT "affiliate_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_visits" ADD CONSTRAINT "affiliate_visits_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_commissions_referral_idx" ON "affiliate_commissions" USING btree ("referral_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_customers_legacy_key" ON "affiliate_customers" USING btree ("legacy_affwp_customer_id");--> statement-breakpoint
CREATE INDEX "affiliate_customers_email_idx" ON "affiliate_customers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payout_items_referral_key" ON "affiliate_payout_items" USING btree ("referral_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payouts_legacy_key" ON "affiliate_payouts" USING btree ("legacy_affwp_payout_id");--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_referrals_legacy_key" ON "affiliate_referrals" USING btree ("legacy_affwp_referral_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_referrals_order_affiliate_key" ON "affiliate_referrals" USING btree ("order_id","affiliate_id") WHERE "affiliate_referrals"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "affiliate_referrals_affiliate_idx" ON "affiliate_referrals" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_status_idx" ON "affiliate_referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_visits_legacy_key" ON "affiliate_visits" USING btree ("legacy_affwp_visit_id");--> statement-breakpoint
CREATE INDEX "affiliate_visits_affiliate_idx" ON "affiliate_visits" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_legacy_affwp_affiliate_id_key" ON "affiliates" USING btree ("legacy_affwp_affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_user_key" ON "affiliates" USING btree ("user_id") WHERE "affiliates"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_username_slug_key" ON "affiliates" USING btree (lower("username_slug")) WHERE "affiliates"."username_slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "affiliates_status_idx" ON "affiliates" USING btree ("status");--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_notes_legacy_wc_note_id_key" ON "order_notes" USING btree ("legacy_wc_note_id");