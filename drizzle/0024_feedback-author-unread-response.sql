-- Notify feedback author when an admin/manager adds or updates a response (admin_notes).
-- Idempotent: safe to run again on Postgres 11+ (IF NOT EXISTS).
-- If Vercel shows "Server Components render" errors after deploy, run this on production DATABASE_URL.
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "author_has_unread_response" boolean DEFAULT false NOT NULL;
