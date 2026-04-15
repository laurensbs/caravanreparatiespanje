-- Garage-admin sync metadata on repair_jobs
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "garage_last_update_at" timestamp with time zone;
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "garage_last_update_type" varchar(100);
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "garage_last_updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "garage_needs_admin_attention" boolean NOT NULL DEFAULT false;
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "garage_unread_updates_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "repair_jobs_garage_attention_idx" ON "repair_jobs" USING btree ("garage_needs_admin_attention");
