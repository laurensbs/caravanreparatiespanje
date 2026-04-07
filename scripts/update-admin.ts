import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { hash } from "bcryptjs";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const hashedPassword = await hash("admin1234", 12);
  await sql`UPDATE users SET name = 'Jake', email = 'jake' WHERE email = 'admin@repair.local'`;
  await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE email = 'jake'`;
  const result = await sql`SELECT name, email FROM users WHERE email = 'jake'`;
  console.log("Updated:", result[0]);
}

main();
