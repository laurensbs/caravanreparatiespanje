-- Bidirectional admin ↔ garage thread per repair.
-- Adds an enum + repair_messages table backing the full conversation, while
-- repair_jobs.garage_admin_message keeps powering the single banner.

DO $$ BEGIN
  CREATE TYPE "repair_message_direction" AS ENUM ('admin_to_garage', 'garage_to_admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "repair_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repair_job_id" uuid NOT NULL REFERENCES "repair_jobs"("id") ON DELETE CASCADE,
  "direction" "repair_message_direction" NOT NULL,
  "body" text NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "author_name" varchar(120),
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "repair_messages_job_idx" ON "repair_messages" ("repair_job_id");
CREATE INDEX IF NOT EXISTS "repair_messages_created_idx" ON "repair_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "repair_messages_unread_idx" ON "repair_messages" ("repair_job_id", "direction", "read_at");
