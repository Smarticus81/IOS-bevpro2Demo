// Database configuration that works in both client and server contexts
export function getDatabaseUrl(): string {  
  try {
    // Check if we're in browser context
    if (typeof window !== 'undefined') {
      return import.meta.env.VITE_DATABASE_URL || '';
    }
    // Server context uses process.env
    return process.env.DATABASE_URL || '';
  } catch (error) {
    console.error('Error accessing database URL:', error);
    return '';
  }
}

// Validate database URL
export function validateDatabaseUrl(url: string): boolean {
  return url.length > 0 && (
    url.startsWith('postgres://') || 
    url.startsWith('postgresql://')
  );
}