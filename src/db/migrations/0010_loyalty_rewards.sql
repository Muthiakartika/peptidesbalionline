CREATE TYPE "public"."loyalty_referral_status" AS ENUM('pending', 'rewarded', 'reversed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."loyalty_transaction_type" AS ENUM('earn', 'redeem', 'reverse', 'restore', 'adjust', 'migration');--> statement-breakpoint
CREATE TABLE "loyalty_members" (
	"user_id" text PRIMARY KEY NOT NULL,
	"referral_code" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_rewardswp_member_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text,
	"referred_email" text,
	"status" "loyalty_referral_status" DEFAULT 'pending' NOT NULL,
	"friend_coupon_code" text,
	"reward_coupon_code" text,
	"referred_order_id" uuid,
	"note" text,
	"legacy_rewardswp_referral_id" integer,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "loyalty_transaction_type" NOT NULL,
	"credits" integer NOT NULL,
	"source" text NOT NULL,
	"order_id" uuid,
	"coupon_code" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referred_order_id_orders_id_fk" FOREIGN KEY ("referred_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_members_referral_code_key" ON "loyalty_members" USING btree (lower("referral_code"));--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_members_legacy_rewardswp_member_id_key" ON "loyalty_members" USING btree ("legacy_rewardswp_member_id");--> statement-breakpoint
CREATE INDEX "loyalty_referrals_referrer_idx" ON "loyalty_referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "loyalty_referrals_order_idx" ON "loyalty_referrals" USING btree ("referred_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_referrals_referred_user_key" ON "loyalty_referrals" USING btree ("referred_user_id") WHERE "loyalty_referrals"."referred_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_referrals_friend_coupon_key" ON "loyalty_referrals" USING btree (lower("friend_coupon_code")) WHERE "loyalty_referrals"."friend_coupon_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_referrals_legacy_rewardswp_referral_id_key" ON "loyalty_referrals" USING btree ("legacy_rewardswp_referral_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_user_idx" ON "loyalty_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_order_idx" ON "loyalty_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_transactions_welcome_key" ON "loyalty_transactions" USING btree ("user_id") WHERE "loyalty_transactions"."source" = 'welcome';