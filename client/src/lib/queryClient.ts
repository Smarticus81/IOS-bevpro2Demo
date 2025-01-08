import { QueryClient, type Query } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }

          throw new Error(`${res.status}: ${await res.text()}`);
        }

        return res.json();
      },
      // Enable real-time updates for inventory-related queries
      refetchInterval: (query: Query) => {
        const queryKey = query.queryKey[0] as string;
        // Refetch inventory data every 5 seconds
        if (queryKey.includes('/api/pour-inventory') || 
            queryKey.includes('/api/pour-transactions') ||
            queryKey.includes('/api/drinks')) {
          return 5000;
        }
        return false;
      },
      refetchOnWindowFocus: true,
      staleTime: 0, // Consider data stale immediately for real-time updates
      gcTime: 1000 * 60 * 5, // Cache for 5 minutes before garbage collection
      retry: false,
    },
    mutations: {
      retry: false,
      onSuccess: () => {
        // Invalidate and refetch inventory queries after any mutation
        queryClient.invalidateQueries({ queryKey: ['/api/pour-inventory'] });
        queryClient.invalidateQueries({ queryKey: ['/api/pour-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
      },
    }
  },
});