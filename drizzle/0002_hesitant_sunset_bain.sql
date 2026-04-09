CREATE TYPE "public"."contact_type" AS ENUM('person', 'business');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "customer_tags_customer_id_tag_id_pk" PRIMARY KEY("customer_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "unit_tags" (
	"unit_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "unit_tags_unit_id_tag_id_pk" PRIMARY KEY("unit_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "contact_type" "contact_type" DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address" varchar(500);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "postal_code" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "province" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vatnumber" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "mobile" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "holded_contact_id" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "holded_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "markup_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "holded_product_id" varchar(255);--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_invoice_id" varchar(255);--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_invoice_num" varchar(100);--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_quote_id" varchar(255);--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_quote_num" varchar(100);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "holded_contact_id" varchar(255);--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_tags" ADD CONSTRAINT "unit_tags_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_tags" ADD CONSTRAINT "unit_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_tags_customer_idx" ON "customer_tags" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "unit_tags_unit_idx" ON "unit_tags" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "unit_tags_tag_idx" ON "unit_tags" USING btree ("tag_id");