import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Drink } from '@db/schema';

type InventoryUpdate = {
  type: 'inventory_change' | 'drinks_refresh';
  data: {
    drinkId?: number;
    newInventory?: number;
    sales?: number;
    timestamp?: string;
    items?: Drink[];
  };
};

export function useInventory() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    console.log('Attempting WebSocket connection...');
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setSocket(ws);
      setRetryCount(0); // Reset retry count on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const update: InventoryUpdate = JSON.parse(event.data);
        console.log('Received inventory update:', update);

        if (update.type === 'inventory_change') {
          // Update single drink inventory
          queryClient.setQueryData(['api/drinks'], (oldData: any) => {
            if (!oldData?.drinks) return oldData;

            const updatedDrinks = oldData.drinks.map((drink: Drink) =>
              drink.id === update.data.drinkId
                ? {
                    ...drink,
                    inventory: update.data.newInventory,
                    sales: update.data.sales
                  }
                : drink
            );

            console.log('Updated drink inventory:', {
              drinkId: update.data.drinkId,
              newInventory: update.data.newInventory
            });

            return {
              ...oldData,
              drinks: updatedDrinks
            };
          });
        } else if (update.type === 'drinks_refresh') {
          console.log('Refreshing all drinks data');
          queryClient.invalidateQueries({ queryKey: ['api/drinks'] });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setSocket(null);

      // Implement exponential backoff for reconnection
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
  };
}