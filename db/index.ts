import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "@db/schema";
import { logger } from '@/lib/logger';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

async function createDatabaseConnection(retryCount = 0) {
  try {
    const client = postgres(process.env.DATABASE_URL, {
      max: 10, // connection pool size
      idle_timeout: 20, // max idle time for a connection
      connect_timeout: 10,
      ssl: 'require',
      max_lifetime: 60 * 30 // 30 minutes
    });

    // Test the connection
    await client`SELECT 1`;
    logger.info('Database connection established successfully');
    return client;
  } catch (error) {
    logger.error('Database connection error:', error);

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return createDatabaseConnection(retryCount + 1);
    }

    throw new Error(`Failed to connect to database after ${MAX_RETRIES} attempts`);
  }
}

let client: postgres.Sql;
let dbInstance: ReturnType<typeof drizzle>;

export async function getDb() {
  if (!dbInstance) {
    client = await createDatabaseConnection();
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

// Initialize the connection
getDb().catch(error => {
  logger.error('Failed to initialize database connection:', error);
  process.exit(1);
});

// Export the schema for use in other files
export { schema };

// Handle cleanup on application shutdown
process.on('SIGTERM', async () => {
  logger.info('Closing database connections...');
  if (client) {
    await client.end();
  }
});