// Server-side configuration handler
import { validateDatabaseUrl } from "../db/config";

interface ServerConfig {
  databaseUrl: string;
  openaiKey: string;
}

export function getServerConfig(): ServerConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  if (!validateDatabaseUrl(databaseUrl)) {
    throw new Error("Invalid DATABASE_URL format");
  }

  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  return {
    databaseUrl,
    openaiKey,
  };
}
