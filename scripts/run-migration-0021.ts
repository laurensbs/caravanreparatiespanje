import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);
  const migration = fs.readFileSync("drizzle/0021_equipment-requests.sql", "utf-8");
  // Split on semicolons but keep DO blocks intact
  const statements: string[] = [];
  let current = "";
  for (const line of migration.split("\n")) {
    current += line + "\n";
    if (line.trim().endsWith(";") && !current.includes("DO $$") || 
        (current.includes("DO $$") && line.trim() === "END $$;")) {
      statements.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());

  for (const stmt of statements) {
    console.log("Running:", stmt.slice(0, 80) + "...");
    await sql.query(stmt);
  }
  console.log("Migration 0021 complete!");
}

main().catch(console.error);
