-- Add ready_for_check to repair_status enum
ALTER TYPE repair_status ADD VALUE IF NOT EXISTS 'ready_for_check' BEFORE 'completed';
