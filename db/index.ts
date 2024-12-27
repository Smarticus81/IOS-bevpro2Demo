import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { getServerConfig } from "../server/config";

let db: ReturnType<typeof drizzle>;

try {
  const config = getServerConfig();

  // Initialize database connection
  db = drizzle({
    connection: config.databaseUrl,
    schema,
    ws: ws,
  });

} catch (error) {
  console.error("Failed to initialize database:", error);
  throw error;
}

// Export database instance and schema
export { db, schema };