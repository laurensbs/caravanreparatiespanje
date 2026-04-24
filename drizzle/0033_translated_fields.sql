-- Automatische vertaling van repair-teksten naar EN/ES/NL via DeepL.
-- We bewaren de brontaal + de 2 vertalingen per tekst-veld zodat we
-- per iPad-profiel de juiste taal kunnen laten zien (t(en, es, nl)).

ALTER TABLE "repair_jobs"
  ADD COLUMN IF NOT EXISTS "title_es" varchar(500),
  ADD COLUMN IF NOT EXISTS "title_nl" varchar(500),
  ADD COLUMN IF NOT EXISTS "description_es" text,
  ADD COLUMN IF NOT EXISTS "description_nl" text,
  ADD COLUMN IF NOT EXISTS "title_lang" varchar(2),
  ADD COLUMN IF NOT EXISTS "description_lang" varchar(2);

ALTER TABLE "repair_findings"
  ADD COLUMN IF NOT EXISTS "description_es" text,
  ADD COLUMN IF NOT EXISTS "description_nl" text,
  ADD COLUMN IF NOT EXISTS "description_lang" varchar(2);
