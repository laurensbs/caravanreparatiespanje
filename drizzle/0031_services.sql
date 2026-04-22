-- Services catalog + per-repair service requests. Labour-style fixed-price
-- items (waxing, ozon treatment, deepclean, etc.) that flow through the
-- estimate and onto the Holded invoice.

ALTER TYPE "public"."estimate_line_type" ADD VALUE IF NOT EXISTS 'service';
--> statement-breakpoint
ALTER TYPE "public"."estimate_line_source" ADD VALUE IF NOT EXISTS 'service_request';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(500) NOT NULL,
  "description" text,
  "category" varchar(50),
  "default_price" numeric(10, 2) NOT NULL,
  "tax_percent" numeric(5, 2) DEFAULT '21' NOT NULL,
  "holded_product_id" varchar(255),
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "services_category_idx" ON "services" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_active_idx" ON "services" USING btree ("active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repair_job_id" uuid NOT NULL,
  "service_id" uuid,
  "service_name" varchar(500) NOT NULL,
  "quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "tax_percent" numeric(5, 2) DEFAULT '21' NOT NULL,
  "notes" text,
  "include_in_estimate" boolean DEFAULT true NOT NULL,
  "completed_at" timestamp with time zone,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "service_requests_job_idx" ON "service_requests" USING btree ("repair_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_service_idx" ON "service_requests" USING btree ("service_id");
--> statement-breakpoint

ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_repair_job_id_repair_jobs_id_fk"
  FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_service_id_services_id_fk"
  FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Seed the initial services catalog so the shop can start using the picker
-- immediately. Prices are exclusive of VAT.
INSERT INTO "services" ("name", "category", "default_price", "tax_percent", "sort_order") VALUES
  ('Waxing — big caravan', 'care', 200, 21, 10),
  ('Waxing — small caravan', 'care', 175, 21, 20),
  ('Inside cleaning with ozon (≤4.5m, before season)', 'cleaning', 250, 21, 30),
  ('Deepclean (>4.5m)', 'cleaning', 300, 21, 40),
  ('Servicebeurt uitgebreid (excl. repairs)', 'maintenance', 225, 21, 50),
  ('Airco maintenance (clean in/out filters, run test)', 'maintenance', 100, 21, 55),
  ('Ozone treatment', 'care', 75, 21, 60),
  ('Charging battery / mover', 'maintenance', 25, 21, 70),
  ('Greasing legs', 'maintenance', 75, 21, 75),
  ('Outside wash after holiday / before storing', 'care', 75, 21, 80),
  ('Quick inside check (photo audit)', 'inspection', 40, 21, 90)
ON CONFLICT DO NOTHING;
