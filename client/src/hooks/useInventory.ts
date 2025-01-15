import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Drink } from '@db/schema';

type InventoryUpdate = {
  type: string;
  data: {
    type?: 'INVENTORY_CHANGE' | 'DRINKS_UPDATE';
    drinkId?: number;
    newInventory?: number;
    sales?: number;
    items?: Drink[];
    timestamp: string;
  };
  status?: string;
};

export function useInventory() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    console.log('Attempting WebSocket connection...');
    // Determine the WebSocket protocol based on the page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(`${protocol}${window.location.host}`);

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setSocket(ws);
      setRetryCount(0); // Reset retry count on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const update: InventoryUpdate = JSON.parse(event.data);
        console.log('Received WebSocket message:', update);

        // Handle status messages
        if (update.type === 'status') {
          console.log('WebSocket status:', update.status);
          return;
        }

        // Handle inventory updates
        if (update.type === 'INVENTORY_UPDATE' && update.data) {
          if (update.data.type === 'INVENTORY_CHANGE' && update.data.drinkId) {
            console.log('Processing inventory change:', update.data);
            queryClient.setQueryData(['api/drinks'], (oldData: any) => {
              if (!oldData?.drinks) {
                console.log('No existing drinks data found');
                return oldData;
              }

              const updatedDrinks = oldData.drinks.map((drink: Drink) => {
                if (drink.id === update.data.drinkId) {
                  console.log('Updating drink:', {
                    id: drink.id,
                    oldInventory: drink.inventory,
                    newInventory: update.data.newInventory
                  });
                  return {
                    ...drink,
                    inventory: update.data.newInventory,
                    sales: update.data.sales
                  };
                }
                return drink;
              });

              return { ...oldData, drinks: updatedDrinks };
            });
          } else if (update.data.type === 'DRINKS_UPDATE' && update.data.items) {
            console.log('Processing full drinks update');
            queryClient.setQueryData(['api/drinks'], { drinks: update.data.items });
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

      // Implement exponential backoff for reconnection
      const maxRetries = 5;
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);

      if (retryCount < maxRetries) {
        console.log(`Attempting reconnection in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, backoffTime);
      } else {
        console.log('Max retry attempts reached, manual refresh required');
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