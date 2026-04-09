ALTER TABLE "repair_jobs" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "repair_jobs" ADD COLUMN "internal_cost" NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS "repair_jobs_deleted_idx" ON "repair_jobs" ("deleted_at");
