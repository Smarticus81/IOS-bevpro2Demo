import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

// Get database URL from environment
const databaseUrl = import.meta.env?.VITE_DATABASE_URL || process.env.DATABASE_URL;

// Ensure database URL is available
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Initialize database connection
export const db = drizzle({
  connection: databaseUrl,
  schema,
  ws: ws,
});

// Export schema for use in other parts of the application
export * from "@db/schema";

// Log successful initialization
console.log('Database connection initialized successfully');