import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sql, schema });
}

// Lazy singleton — only connects when first accessed at runtime
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(target, prop, receiver) {
    if (!("_instance" in target)) {
      Object.assign(target, { _instance: getDb() });
    }
    return Reflect.get((target as any)._instance, prop, receiver);
  },
});

export type Database = ReturnType<typeof getDb>;
