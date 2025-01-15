import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Drink } from '@db/schema';

type InventoryUpdate = {
  type: 'INVENTORY_UPDATE' | 'status';
  data?: {
    type: 'INVENTORY_CHANGE' | 'DRINKS_UPDATE';
    drinkId?: number;
    newInventory?: number;
    sales?: number;
    items?: Drink[];
    timestamp: string;
  };
  status?: string;
  timestamp: string;
};

export function useInventory() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [localInventory, setLocalInventory] = useState<Record<number, number>>({});
  const queryClient = useQueryClient();

  const updateLocalInventory = useCallback((drinkId: number, quantity: number) => {
    setLocalInventory(prev => ({
      ...prev,
      [drinkId]: (prev[drinkId] || 0) - quantity
    }));

    // Update React Query cache immediately
    queryClient.setQueryData(['api/drinks'], (oldData: any) => {
      if (!oldData?.drinks) return oldData;

      const updatedDrinks = oldData.drinks.map((drink: Drink) => {
        if (drink.id === drinkId) {
          const currentLocalCount = localInventory[drinkId] || drink.inventory;
          return {
            ...drink,
            inventory: currentLocalCount - quantity
          };
        }
        return drink;
      });

      return { drinks: updatedDrinks };
    });
  }, [queryClient, localInventory]);

  const resetLocalInventory = useCallback(() => {
    setLocalInventory({});
    queryClient.invalidateQueries(['api/drinks']);
  }, [queryClient]);

  const connect = useCallback(() => {
    console.log('Attempting WebSocket connection...');
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(`${protocol}${window.location.host}`);

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setSocket(ws);
      setRetryCount(0);
    };

    ws.onmessage = (event) => {
      try {
        const update: InventoryUpdate = JSON.parse(event.data);

        if (update.type === 'status') {
          console.log('WebSocket status:', update.status);
          return;
        }

        // Only process database updates after order completion
        if (update.type === 'INVENTORY_UPDATE' && update.data) {
          setLastUpdate(update.data.timestamp);

          if (update.data.type === 'INVENTORY_CHANGE') {
            // Reset local inventory for this drink after order completion
            setLocalInventory(prev => {
              const { [update.data!.drinkId!]: _, ...rest } = prev;
              return rest;
            });
          } else if (update.data.type === 'DRINKS_UPDATE') {
            // Reset all local inventory after full refresh
            setLocalInventory({});
          }

          // Always invalidate queries to get fresh data
          queryClient.invalidateQueries(['api/drinks']);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setSocket(null);

      const maxRetries = 5;
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);

      if (retryCount < maxRetries) {
        console.log(`Attempting reconnection in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, backoffTime);
      }
    };

    return ws;
  }, [queryClient, retryCount]);

  useEffect(() => {
    const ws = connect();
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('Cleaning up WebSocket connection');
        ws.close();
      }
    };
  }, [connect]);

  return {
    isConnected: socket?.readyState === WebSocket.OPEN,
    lastUpdate,
    updateLocalInventory,
    resetLocalInventory,
    localInventory
  };
}