// Database configuration that works in both client and server contexts
export function getDatabaseUrl(): string {  
  const url = import.meta.env?.VITE_DATABASE_URL || process.env.DATABASE_URL;

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