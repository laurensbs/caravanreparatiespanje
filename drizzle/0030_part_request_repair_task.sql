-- Link part requests to a specific repair task (garage thinks per task).
ALTER TABLE "part_requests"
  ADD COLUMN IF NOT EXISTS "repair_task_id" uuid REFERENCES "repair_tasks"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "part_requests_repair_task_id_idx" ON "part_requests" ("repair_task_id");
