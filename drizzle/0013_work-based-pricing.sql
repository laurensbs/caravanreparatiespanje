-- Migration 0013: Work-based pricing — tasks drive estimates
-- Add billable/hours fields to repair_tasks
ALTER TABLE repair_tasks ADD COLUMN estimated_hours NUMERIC(6, 2);
ALTER TABLE repair_tasks ADD COLUMN actual_hours NUMERIC(6, 2);
ALTER TABLE repair_tasks ADD COLUMN billable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE repair_tasks ADD COLUMN hourly_rate NUMERIC(10, 2);
ALTER TABLE repair_tasks ADD COLUMN include_in_estimate BOOLEAN NOT NULL DEFAULT true;

-- Add sell price fields to part_requests
ALTER TABLE part_requests ADD COLUMN sell_price NUMERIC(10, 2);
ALTER TABLE part_requests ADD COLUMN markup_percent NUMERIC(5, 2);
ALTER TABLE part_requests ADD COLUMN include_in_estimate BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE part_requests ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
CREATE INDEX part_requests_supplier_idx ON part_requests(supplier_id);

-- Create estimate_line_items table (persisted, linked to source)
CREATE TYPE estimate_line_type AS ENUM ('labour', 'part', 'custom');
CREATE TYPE estimate_line_source AS ENUM ('task', 'part_request', 'manual');

CREATE TABLE estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  type estimate_line_type NOT NULL DEFAULT 'custom',
  source_type estimate_line_source NOT NULL DEFAULT 'manual',
  source_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  internal_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX estimate_line_items_job_idx ON estimate_line_items(repair_job_id);
CREATE INDEX estimate_line_items_source_idx ON estimate_line_items(source_type, source_id);

-- Add discount_percent to repair_jobs for persistence
ALTER TABLE repair_jobs ADD COLUMN discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
