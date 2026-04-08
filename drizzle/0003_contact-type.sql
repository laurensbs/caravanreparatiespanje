-- Add contact_type enum and column to customers table
CREATE TYPE "public"."contact_type" AS ENUM('person', 'business');
ALTER TABLE "customers" ADD COLUMN "contact_type" "public"."contact_type" DEFAULT 'person' NOT NULL;
