-- Notify feedback author when an admin/manager adds or updates a response (admin_notes).
ALTER TABLE "feedback" ADD COLUMN "author_has_unread_response" boolean DEFAULT false NOT NULL;
