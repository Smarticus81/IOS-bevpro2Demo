// Database configuration that works in both client and server contexts
export function getDatabaseUrl(): string {  
  // In client context, use the Vite environment variable
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_DATABASE_URL || '';
  }

  // In server context, use process.env
  return process.env.DATABASE_URL || '';
}

// Validate database URL
export function validateDatabaseUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}