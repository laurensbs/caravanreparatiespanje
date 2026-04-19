-- Part request chase tracking
--
-- Adds `last_chased_at` so the admin can mark a part_request as
-- "I've chased the supplier today" and have it disappear from the
-- "Parts to chase" widget for 24 hours. Without this column the widget
-- would re-show the same row every time the dashboard refreshes,
-- which trains the team to ignore it.

ALTER TABLE "part_requests"
  ADD COLUMN IF NOT EXISTS "last_chased_at" timestamp with time zone;

-- Helps both the widget query (chasing oldest first) and the part
-- requests page sort. Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS "part_requests_chase_idx"
  ON "part_requests" ("status", "created_at")
  WHERE "status" IN ('requested', 'ordered', 'shipped');
