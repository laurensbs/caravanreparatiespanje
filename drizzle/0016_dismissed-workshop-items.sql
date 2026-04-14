-- Track manually dismissed workshop-sourced estimate items
CREATE TABLE IF NOT EXISTS dismissed_workshop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  source_type estimate_line_source NOT NULL,
  source_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS dismissed_workshop_items_job_idx
  ON dismissed_workshop_items(repair_job_id);
CREATE INDEX IF NOT EXISTS dismissed_workshop_items_source_idx
  ON dismissed_workshop_items(repair_job_id, source_type, source_id);
