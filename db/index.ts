import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const db = drizzle({
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
});

// Export schema and sql for use in other files
export { schema, sql };

// Basic error handling for database operations
process.on('unhandledRejection', (error) => {
  console.error('Database operation failed:', error);
  process.exit(1);
});