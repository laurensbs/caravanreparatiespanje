-- Voeg "must_change_password" vlag toe aan users. Alleen admin-accounts
-- (Jake, Johan, Noah) moeten bij de volgende login een nieuw wachtwoord
-- kiezen. Laurens en de garage-werkers (*@garage.local, die via de garage-
-- PWA met PIN inloggen) blijven ongemoeid.
-- Idempotent: veilig om opnieuw te draaien op Postgres 11+ (IF NOT EXISTS).
-- Als Vercel "Server Components render"-fouten toont na deploy: draai dit op
-- de productie DATABASE_URL.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;

UPDATE "users"
SET "must_change_password" = true
WHERE lower("email") <> 'laurensbos@hotmail.com'
  AND "email" NOT LIKE '%@garage.local';
