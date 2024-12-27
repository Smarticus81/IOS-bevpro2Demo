// Client-side configuration
interface ClientConfig {
  openaiKey: string | undefined;
}

export function getClientConfig(): ClientConfig {
  return {
    openaiKey: import.meta.env.VITE_OPENAI_API_KEY,
  };
}

// Validate configuration
export function validateClientConfig(): boolean {
  const config = getClientConfig();
  return !!config.openaiKey;
}