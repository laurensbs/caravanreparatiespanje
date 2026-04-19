-- Adds two related features for the garage app:
--
-- 1. tool_requests: a "need a tool / part / supply" inbox that the workshop
--    iPad can post to and the office picks up. Free-text on purpose so it
--    matches how the team actually talks today (no catalog to maintain).
--
-- 2. voice_notes: short audio recordings attached to comments, blockers,
--    findings and tool requests. Workers wear gloves; speaking is faster
--    and less error-prone than typing on the iPad. We use a polymorphic
--    owner_type/owner_id pair so we don't have to add an audio_url column
--    to four different tables.

DO $$ BEGIN
  CREATE TYPE "tool_request_status" AS ENUM ('open', 'resolved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "voice_note_owner_type" AS ENUM (
    'comment', 'blocker', 'finding', 'tool_request', 'repair_message'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "tool_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repair_job_id" uuid REFERENCES "repair_jobs"("id") ON DELETE SET NULL,
  "requested_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "requested_by_label" varchar(80),
  "description" text NOT NULL,
  "status" "tool_request_status" NOT NULL DEFAULT 'open',
  "resolved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamptz,
  "resolution_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tool_requests_status_idx"
  ON "tool_requests" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "tool_requests_job_idx"
  ON "tool_requests" ("repair_job_id");

CREATE TABLE IF NOT EXISTS "voice_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "repair_job_id" uuid REFERENCES "repair_jobs"("id") ON DELETE CASCADE,
  "owner_type" "voice_note_owner_type" NOT NULL,
  "owner_id" uuid NOT NULL,
  "duration_seconds" integer NOT NULL DEFAULT 0,
  "mime_type" varchar(80) NOT NULL,
  "url" text NOT NULL,
  "onedrive_path" text,
  "onedrive_folder_url" text,
  "onedrive_item_id" text,
  "transcript" text,
  "uploaded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_by_label" varchar(80),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "voice_notes_owner_idx"
  ON "voice_notes" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "voice_notes_job_idx"
  ON "voice_notes" ("repair_job_id");
