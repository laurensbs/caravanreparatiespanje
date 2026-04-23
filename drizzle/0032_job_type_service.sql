-- Add 'service' value to the existing job_type enum so new work-orders
-- can be created as Service (alongside Repair). Legacy values
-- (wax/maintenance/inspection) blijven in het enum bestaan voor
-- bestaande rijen en filterbaarheid.

ALTER TYPE "public"."job_type" ADD VALUE IF NOT EXISTS 'service';
