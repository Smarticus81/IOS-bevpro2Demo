import { neon } from '@neondatabase/serverless';
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the neon connection
const sql_connection = neon(process.env.DATABASE_URL);

// Create the drizzle db instance
export const db = drizzle(sql_connection, { schema });

// Export schema and sql for use in other files
export { schema, sql };

// Basic error handling for database operations
process.on('unhandledRejection', (error) => {
  console.error('Database operation failed:', error);
  process.exit(1);
});