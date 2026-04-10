ALTER TYPE "public"."invoice_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'no_damage' BEFORE 'quote_needed';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'rejected' BEFORE 'archived';--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "internal_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "length" varchar(50);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "storage_location" varchar(255);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "storage_type" varchar(100);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "current_position" varchar(255);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "nfc_tag" varchar(255);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "checklist" text;--> statement-breakpoint
CREATE INDEX "repair_jobs_deleted_idx" ON "repair_jobs" USING btree ("deleted_at");