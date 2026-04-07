import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { hash } from "bcryptjs";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const hashedPassword = await hash("admin1234", 12);
  await sql`UPDATE users SET name = 'Jake', email = 'jake', active = true WHERE email IN ('admin@repair.local', 'jake@repair.local', 'jake')`;
  await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE email = 'jake'`;
  const result = await sql`SELECT name, email, active FROM users WHERE email = 'jake'`;
  console.log("Updated:", result[0]);
}

main();
