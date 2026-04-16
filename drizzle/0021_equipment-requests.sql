DO $$ BEGIN
  CREATE TYPE request_type AS ENUM ('part', 'equipment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "part_requests" ADD COLUMN "request_type" request_type NOT NULL DEFAULT 'part';
