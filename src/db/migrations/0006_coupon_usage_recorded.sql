ALTER TABLE "orders" ADD COLUMN "coupon_usage_recorded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- WooCommerce counted the coupons of every placed order that isn't cancelled, failed or a draft.
UPDATE "orders" SET "coupon_usage_recorded" = true WHERE "status" NOT IN ('cancelled', 'failed', 'checkout-draft');
