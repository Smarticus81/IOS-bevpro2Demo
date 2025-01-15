import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: 'INVENTORY_UPDATE' | 'POUR_UPDATE' | 'status';
  data?: any;
  status?: string;
  timestamp: string;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Create WebSocket connection using current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log('WebSocket message received:', message);

        // Handle different types of updates
        switch (message.type) {
          case 'INVENTORY_UPDATE':
            // Handle different inventory update types
            if (message.data?.type === 'drinks_refresh' || message.data?.type === 'drinks') {
              // Full refresh of drinks data
              queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
            } else if (message.data?.type === 'inventory_change') {
              // Individual drink update
              queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
              if (message.data?.drinkId) {
                queryClient.invalidateQueries({ 
                  queryKey: [`/api/drinks/${message.data.drinkId}`]
                });
              }
            }
            break;

          case 'POUR_UPDATE':
            // Invalidate pour-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/pour-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['/api/pour-transactions'] });
            break;

          case 'status':
            console.log('WebSocket status:', message.status);
            break;

          default:
            console.warn('Received unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    // Connection opened
    ws.onopen = () => {
      console.log('WebSocket connection established');
      // Clear any pending reconnection timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    // Connection error
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      reconnect();
    };

    // Connection closed
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      reconnect();
    };
  }, [queryClient]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...');
      connect();
    }, 5000); // 5 second delay before reconnecting
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
}