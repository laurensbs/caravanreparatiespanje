-- Adds a per-user UI/notification language preference. The garage iPad
-- has a device-wide default; this column lets us additionally show
-- toasts and confirmations in the technician's own language right
-- after they perform an action, without forcing them to swap the
-- whole UI for everyone else.

DO $$ BEGIN
  CREATE TYPE "user_language" AS ENUM ('en', 'es', 'nl');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preferred_language" "user_language"
  NOT NULL DEFAULT 'en';

-- Seed Dutch for Mark and Rolf, Spanish for everyone else who looks
-- like a garage technician. We intentionally skip admin users — they
-- get the default 'en' which lines up with the office UI today.
UPDATE "users"
SET "preferred_language" = 'nl'
WHERE LOWER("name") LIKE 'mark%' OR LOWER("name") LIKE 'rolf%';

UPDATE "users"
SET "preferred_language" = 'es'
WHERE "email" LIKE '%@garage.local'
  AND "preferred_language" = 'en';
