import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

const DATABASE_URL = typeof process !== 'undefined' && process.env.DATABASE_URL ? 
  process.env.DATABASE_URL : 
  import.meta.env.VITE_DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Ensure the database is properly provisioned.",
  );
}

if (!DATABASE_URL.startsWith('postgres://') && !DATABASE_URL.startsWith('postgresql://')) {
  throw new Error(
    "Invalid DATABASE_URL format. Must start with postgres:// or postgresql://",
  );
}

export const db = drizzle({
  connection: DATABASE_URL,
  schema,
  ws: ws,
});

export { schema };