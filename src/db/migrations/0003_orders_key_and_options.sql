ALTER TABLE "order_items" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_path" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_key_key" ON "orders" USING btree ("order_key");