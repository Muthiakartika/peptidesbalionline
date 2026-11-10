CREATE TYPE "public"."backorder_policy" AS ENUM('no', 'notify', 'yes');--> statement-breakpoint
CREATE TYPE "public"."inventory_reason" AS ENUM('order', 'refund', 'cancellation', 'manual', 'migration');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('simple', 'variable');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('draft', 'publish', 'private', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('instock', 'outofstock', 'onbackorder');--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"manage_stock" boolean DEFAULT false NOT NULL,
	"stock_quantity" integer,
	"stock_status" "stock_status" DEFAULT 'instock' NOT NULL,
	"backorders" "backorder_policy" DEFAULT 'no' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "inventory_reason" NOT NULL,
	"order_id" uuid,
	"actor_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sanity_id" text NOT NULL,
	"legacy_wc_product_id" integer,
	"type" "product_type" NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"legacy_wc_variation_id" integer,
	"variant_key" text NOT NULL,
	"sku" text,
	"currency" char(3) DEFAULT 'IDR' NOT NULL,
	"price_minor" bigint NOT NULL,
	"regular_price_minor" bigint NOT NULL,
	"sale_price_minor" bigint,
	"sale_from" timestamp with time zone,
	"sale_to" timestamp with time zone,
	"status" "record_status" DEFAULT 'publish' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_price_not_negative" CHECK ("product_variants"."price_minor" >= 0 AND "product_variants"."regular_price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_id_mappings" (
	"entity_type" text NOT NULL,
	"legacy_id" text NOT NULL,
	"new_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"step" text NOT NULL,
	"source_count" integer,
	"imported_count" integer,
	"skipped_count" integer,
	"errors" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_product_records_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_movements_variant_idx" ON "inventory_movements" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_records_sanity_id_key" ON "product_records" USING btree ("sanity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_records_legacy_wc_product_id_key" ON "product_records" USING btree ("legacy_wc_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_product_key" ON "product_variants" USING btree ("product_id","variant_key");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_legacy_wc_variation_id_key" ON "product_variants" USING btree ("legacy_wc_variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_id_mappings_key" ON "legacy_id_mappings" USING btree ("entity_type","legacy_id");--> statement-breakpoint
CREATE INDEX "legacy_id_mappings_new_id_idx" ON "legacy_id_mappings" USING btree ("new_id");