-- Add job_type enum and column to repair_jobs
CREATE TYPE "public"."job_type" AS ENUM('repair', 'wax', 'maintenance', 'inspection');

ALTER TABLE "repair_jobs" ADD COLUMN "job_type" "job_type" NOT NULL DEFAULT 'repair';

CREATE INDEX "repair_jobs_job_type_idx" ON "repair_jobs" USING btree ("job_type");
