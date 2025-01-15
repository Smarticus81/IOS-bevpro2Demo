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
  const queryClient = useQueryClient();

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
        console.log('Received WebSocket message:', event.data);
        const update: InventoryUpdate = JSON.parse(event.data);

        // Handle status messages
        if (update.type === 'status') {
          console.log('WebSocket status:', update.status);
          return;
        }

        // Handle inventory updates
        if (update.type === 'INVENTORY_UPDATE' && update.data) {
          setLastUpdate(update.data.timestamp);

          if (update.data.type === 'INVENTORY_CHANGE' && typeof update.data.drinkId === 'number') {
            console.log('Processing inventory change:', update.data);

            queryClient.setQueryData(['api/drinks'], (oldData: any) => {
              if (!oldData?.drinks) {
                console.log('No existing drinks data found');
                return oldData;
              }

              const updatedDrinks = oldData.drinks.map((drink: Drink) => {
                if (drink.id === update.data!.drinkId) {
                  const newDrink = {
                    ...drink,
                    inventory: update.data!.newInventory,
                    sales: update.data!.sales,
                    lastUpdated: update.data!.timestamp
                  };
                  console.log(`Updated drink ${drink.id} inventory:`, {
                    old: drink.inventory,
                    new: newDrink.inventory
                  });
                  return newDrink;
                }
                return drink;
              });

              return { drinks: updatedDrinks };
            });

            // Invalidate queries that might depend on inventory
            queryClient.invalidateQueries(['api/drinks']);
          } else if (update.data.type === 'DRINKS_UPDATE' && Array.isArray(update.data.items)) {
            console.log('Processing full drinks update');
            queryClient.setQueryData(['api/drinks'], { 
              drinks: update.data.items.map(drink => ({
                ...drink,
                lastUpdated: update.data!.timestamp
              }))
            });
            queryClient.invalidateQueries(['api/drinks']);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        console.error('Raw message:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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
      } else {
        console.log('Max retry attempts reached');
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
    lastUpdate
  };
}