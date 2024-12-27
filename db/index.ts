import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { getDatabaseUrl } from "./config";

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const db = drizzle({
  connection: databaseUrl,
  schema,
  ws: ws,
});

// Export schema for use in other parts of the application
export * from "@db/schema";