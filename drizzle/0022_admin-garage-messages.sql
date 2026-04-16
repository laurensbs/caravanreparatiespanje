ALTER TABLE repair_jobs ADD COLUMN garage_admin_message TEXT;
ALTER TABLE repair_jobs ADD COLUMN garage_admin_message_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repair_jobs ADD COLUMN garage_admin_message_read_at TIMESTAMP WITH TIME ZONE;
