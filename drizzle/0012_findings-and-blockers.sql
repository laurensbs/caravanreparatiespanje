-- Findings: structured inspection observations by technicians
CREATE TYPE finding_severity AS ENUM ('minor', 'normal', 'critical');
CREATE TYPE finding_category AS ENUM ('tyres', 'lighting', 'brakes', 'windows', 'water_damage', 'seals', 'door_lock', 'electrical', 'bodywork', 'chassis', 'interior', 'other');

CREATE TABLE repair_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  category finding_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  severity finding_severity NOT NULL DEFAULT 'normal',
  requires_follow_up BOOLEAN NOT NULL DEFAULT false,
  requires_customer_approval BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX repair_findings_job_idx ON repair_findings(repair_job_id);
CREATE INDEX repair_findings_severity_idx ON repair_findings(severity);

-- Blockers: job-level blockers
CREATE TYPE blocker_reason AS ENUM ('waiting_parts', 'waiting_customer', 'unknown_issue', 'no_time', 'missing_info', 'other');

CREATE TABLE repair_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_job_id UUID NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  reason blocker_reason NOT NULL DEFAULT 'other',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX repair_blockers_job_idx ON repair_blockers(repair_job_id);
CREATE INDEX repair_blockers_active_idx ON repair_blockers(active);

-- Add finding_id to photos so photos can be linked to findings
ALTER TABLE repair_photos ADD COLUMN finding_id UUID REFERENCES repair_findings(id) ON DELETE SET NULL;
CREATE INDEX repair_photos_finding_idx ON repair_photos(finding_id);
