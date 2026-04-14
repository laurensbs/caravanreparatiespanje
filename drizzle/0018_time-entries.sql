-- Time entries for time registration / timer
DO $$ BEGIN
  CREATE TYPE "public"."time_entry_source" AS ENUM('garage_timer', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repair_job_id" uuid NOT NULL REFERENCES "repair_jobs"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "duration_minutes" integer,
  "rounded_minutes" integer,
  "source" "time_entry_source" NOT NULL DEFAULT 'garage_timer',
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "time_entries_job_idx" ON "time_entries" USING btree ("repair_job_id");
CREATE INDEX IF NOT EXISTS "time_entries_user_idx" ON "time_entries" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "time_entries_active_idx" ON "time_entries" USING btree ("user_id", "ended_at");
