-- Garage portal schema additions

-- 1. Add technician role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'technician';

-- 2. New enum for repair task status
DO $$ BEGIN
  CREATE TYPE "repair_task_status" AS ENUM ('pending', 'in_progress', 'done', 'problem', 'review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. New enum for final check status  
DO $$ BEGIN
  CREATE TYPE "final_check_status" AS ENUM ('pending', 'passed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create repair_tasks table
CREATE TABLE IF NOT EXISTS "repair_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repair_job_id" uuid NOT NULL REFERENCES "repair_jobs"("id") ON DELETE CASCADE,
  "title" varchar(500) NOT NULL,
  "title_es" varchar(500),
  "title_nl" varchar(500),
  "description" text,
  "status" "repair_task_status" NOT NULL DEFAULT 'pending',
  "sort_order" integer NOT NULL DEFAULT 0,
  "assigned_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "problem_category" varchar(100),
  "problem_note" text,
  "source" varchar(50) NOT NULL DEFAULT 'office',
  "approved_at" timestamp with time zone,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "repair_tasks_job_idx" ON "repair_tasks"("repair_job_id");
CREATE INDEX IF NOT EXISTS "repair_tasks_status_idx" ON "repair_tasks"("status");
CREATE INDEX IF NOT EXISTS "repair_tasks_assigned_idx" ON "repair_tasks"("assigned_user_id");

-- 5. Create repair_photos table
CREATE TABLE IF NOT EXISTS "repair_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repair_job_id" uuid NOT NULL REFERENCES "repair_jobs"("id") ON DELETE CASCADE,
  "repair_task_id" uuid REFERENCES "repair_tasks"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "caption" text,
  "photo_type" varchar(50) NOT NULL DEFAULT 'general',
  "uploaded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "repair_photos_job_idx" ON "repair_photos"("repair_job_id");
CREATE INDEX IF NOT EXISTS "repair_photos_task_idx" ON "repair_photos"("repair_task_id");

-- 6. Add final check fields to repair_jobs
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "final_check_status" "final_check_status";
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "final_check_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "final_check_at" timestamp with time zone;
ALTER TABLE "repair_jobs" ADD COLUMN IF NOT EXISTS "final_check_notes" text;
