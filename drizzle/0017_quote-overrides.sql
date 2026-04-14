CREATE TABLE "quote_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holded_quote_id" varchar(255) NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_overrides_holded_quote_id_unique" UNIQUE("holded_quote_id")
);

DO $$ BEGIN
 ALTER TABLE "quote_overrides" ADD CONSTRAINT "quote_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX "quote_overrides_holded_idx" ON "quote_overrides" USING btree ("holded_quote_id");
