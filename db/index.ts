import { drizzle } from "drizzle-orm/neon-serverless";
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

// Export schema for use in other files
export { schema };

// Handle cleanup on application shutdown
process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  // Assuming drizzle's connection object has an end method, similar to postgres
  // If not, appropriate cleanup method should be used based on drizzle-orm/neon-serverless documentation.
  await db.connection.end(); 
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  db.connection.end().then(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  db.connection.end().then(() => {
    process.exit(1);
  });
});