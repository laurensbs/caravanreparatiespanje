import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { hash } from "bcryptjs";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Set ADMIN_PASSWORD environment variable");
    process.exit(1);
  }
  const name = process.env.ADMIN_NAME || "Jake";
  const email = process.env.ADMIN_EMAIL || "jake";
  const hashedPassword = await hash(password, 12);
  await sql`UPDATE users SET name = ${name}, email = ${email}, active = true WHERE email IN ('admin@repair.local', 'jake@repair.local', 'jake', ${email})`;
  await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE email = ${email}`;
  const result = await sql`SELECT name, email, active FROM users WHERE email = ${email}`;
  console.log("Updated:", result[0]);
}

main();
