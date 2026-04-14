import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "quote_overrides" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "holded_quote_id" varchar(255) NOT NULL,
      "dismissed" boolean DEFAULT false NOT NULL,
      "note" text,
      "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "quote_overrides_holded_quote_id_unique" UNIQUE("holded_quote_id")
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "quote_overrides_holded_idx" ON "quote_overrides" ("holded_quote_id")
  `);
  console.log("Migration 0017 applied successfully");
}

main().catch(console.error);

