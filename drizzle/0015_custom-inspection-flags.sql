ALTER TABLE "repair_jobs" ADD COLUMN "custom_flags" jsonb DEFAULT '[]'::jsonb;
