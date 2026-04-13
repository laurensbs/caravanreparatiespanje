import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  // Create table
  await sql`CREATE TABLE IF NOT EXISTS "part_categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" varchar(50) NOT NULL UNIQUE,
    "label" varchar(100) NOT NULL,
    "icon" varchar(50) NOT NULL DEFAULT 'Package',
    "color" varchar(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400',
    "sort_order" integer NOT NULL DEFAULT 0,
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
  )`;
  console.log("Table created");

  // Seed categories
  await sql`INSERT INTO "part_categories" ("key", "label", "icon", "color", "sort_order") VALUES
    ('electrical', 'Electrical', 'Zap', 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400', 1),
    ('chassis', 'Chassis', 'Wrench', 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400', 2),
    ('windows', 'Windows & Skylights', 'SquareStack', 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400', 3),
    ('bodywork', 'Bodywork', 'Paintbrush', 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400', 4),
    ('plumbing', 'Plumbing & Gas', 'Droplets', 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', 5),
    ('climate', 'Climate', 'Snowflake', 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400', 6),
    ('storage', 'Storage', 'Warehouse', 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', 7),
    ('transport', 'Transport', 'Truck', 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', 8),
    ('cleaning', 'Cleaning', 'Sparkles', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', 9),
    ('services', 'Services', 'Hammer', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400', 10),
    ('materials', 'Materials', 'Package', 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400', 11),
    ('interior', 'Interior', 'Home', 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400', 12)
  ON CONFLICT ("key") DO NOTHING`;
  console.log("Categories seeded");

  // Migrate Dutch → English keys
  await sql`UPDATE "parts" SET "category" = 'electrical' WHERE "category" = 'elektra'`;
  await sql`UPDATE "parts" SET "category" = 'windows' WHERE "category" = 'ramen'`;
  await sql`UPDATE "parts" SET "category" = 'bodywork' WHERE "category" = 'carrosserie'`;
  await sql`UPDATE "parts" SET "category" = 'plumbing' WHERE "category" = 'sanitair'`;
  await sql`UPDATE "parts" SET "category" = 'climate' WHERE "category" = 'klimaat'`;
  await sql`UPDATE "parts" SET "category" = 'storage' WHERE "category" = 'stalling'`;
  await sql`UPDATE "parts" SET "category" = 'cleaning' WHERE "category" = 'reiniging'`;
  await sql`UPDATE "parts" SET "category" = 'services' WHERE "category" = 'diensten'`;
  await sql`UPDATE "parts" SET "category" = 'materials' WHERE "category" = 'materiaal'`;
  await sql`UPDATE "parts" SET "category" = 'interior' WHERE "category" = 'interieur'`;
  console.log("Parts migrated to English keys");

  const cats = await sql`SELECT key, label FROM part_categories ORDER BY sort_order`;
  console.log("\nCategories:", cats.length);
  for (const c of cats) console.log("  -", c.key, "→", c.label);

  const updated = await sql`SELECT category, count(*) as cnt FROM parts WHERE category IS NOT NULL GROUP BY category ORDER BY category`;
  console.log("\nParts by category:");
  for (const r of updated) console.log("  -", r.category, ":", r.cnt);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
