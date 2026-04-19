-- Voeg "must_change_password" vlag toe aan users. Iedereen behalve Laurens
-- moet bij de volgende login een nieuw wachtwoord kiezen (zonder eerst hun
-- huidige wachtwoord in te vullen).
-- Idempotent: veilig om opnieuw te draaien op Postgres 11+ (IF NOT EXISTS).
-- Als Vercel "Server Components render"-fouten toont na deploy: draai dit op
-- de productie DATABASE_URL.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;

UPDATE "users"
SET "must_change_password" = true
WHERE lower("email") <> 'laurensbos@hotmail.com';
