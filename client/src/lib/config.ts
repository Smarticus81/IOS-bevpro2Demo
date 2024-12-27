// Client-side configuration
export const getConfig = () => {
  return {
    databaseUrl: import.meta.env.VITE_DATABASE_URL,
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  };
};
