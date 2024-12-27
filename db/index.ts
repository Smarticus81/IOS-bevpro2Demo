import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: 'require',
  connect_timeout: 10
});

export const db = drizzle(client, { schema });

// Export the schema and raw SQL client for use in other files
export { schema };
export const rawSql = client;
