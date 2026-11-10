CREATE SEQUENCE "public"."category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 300000 CACHE 1;--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"swatches" boolean DEFAULT false NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" integer PRIMARY KEY DEFAULT nextval('category_id_seq') NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"tile_image" jsonb,
	"search_image" jsonb,
	"seo" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_categories_parent_idx" ON "product_categories" USING btree ("parent_id");