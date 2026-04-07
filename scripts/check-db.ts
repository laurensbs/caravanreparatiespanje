import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const counts = await Promise.all([
    sql`SELECT count(*) FROM users`,
    sql`SELECT count(*) FROM locations`,
    sql`SELECT count(*) FROM tags`,
    sql`SELECT count(*) FROM customers`,
    sql`SELECT count(*) FROM units`,
    sql`SELECT count(*) FROM repair_jobs`,
  ]);
  console.log("users:", counts[0][0].count);
  console.log("locations:", counts[1][0].count);
  console.log("tags:", counts[2][0].count);
  console.log("customers:", counts[3][0].count);
  console.log("units:", counts[4][0].count);
  console.log("repair_jobs:", counts[5][0].count);
}

main();
