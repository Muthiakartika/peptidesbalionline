CREATE SEQUENCE "public"."shop_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 200000 CACHE 1;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "shop_id" integer DEFAULT nextval('shop_id_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "status_before_archive" "record_status";--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "category_slugs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "menu_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_records" ADD COLUMN "attributes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "shop_id" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "image" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "product_records_shop_id_key" ON "product_records" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_records_slug_key" ON "product_records" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_shop_id_key" ON "product_variants" USING btree ("shop_id");