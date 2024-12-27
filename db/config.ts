// Database configuration that works in both client and server contexts

// Helper function to safely access environment variables
function getEnvVar(name: string): string | undefined {
  try {
    if (typeof window !== 'undefined') {
      // Client-side
      return (import.meta.env as Record<string, string>)[`VITE_${name}`];
    } else {
      // Server-side
      return process.env[name];
    }
  } catch {
    return undefined;
  }
}

export function getDatabaseUrl(): string {
  const url = getEnvVar('DATABASE_URL');
  if (!url) {
    console.warn('Database URL not found in environment variables');
    return '';
  }
  return url;
}

// Validate database URL
export function validateDatabaseUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

// Get database configuration
export function getDatabaseConfig() {
  const url = getDatabaseUrl();

  if (!url) {
    throw new Error('Database URL is not configured');
  }

  if (!validateDatabaseUrl(url)) {
    throw new Error('Invalid database URL format');
  }

  return {
    url,
    port: getEnvVar('PGPORT'),
    user: getEnvVar('PGUSER'),
    password: getEnvVar('PGPASSWORD'),
    database: getEnvVar('PGDATABASE'),
    host: getEnvVar('PGHOST'),
  };
}