import { useEffect, useState } from 'react';
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
  const queryClient = useQueryClient();

  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const update: InventoryUpdate = JSON.parse(event.data);
        
        if (update.type === 'inventory_change') {
          // Update single drink inventory
          queryClient.setQueryData(['api/drinks'], (oldData: any) => {
            if (!oldData?.drinks) return oldData;
            
            return {
              ...oldData,
              drinks: oldData.drinks.map((drink: Drink) =>
                drink.id === update.data.drinkId
                  ? {
                      ...drink,
                      inventory: update.data.newInventory,
                      sales: update.data.sales
                    }
                  : drink
              )
            };
          });
        } else if (update.type === 'drinks_refresh') {
          // Invalidate drinks query to trigger a refresh
          queryClient.invalidateQueries(['api/drinks']);
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
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return {
    isConnected: !!socket,
  };
}
