// Server-side configuration handler
interface ServerConfig {
  openaiKey: string;
}

export function getServerConfig(): ServerConfig {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  return {
    openaiKey,
  };
}