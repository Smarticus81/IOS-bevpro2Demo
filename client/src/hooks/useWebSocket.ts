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
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
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
              console.log('Refreshing all drinks data');
              queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
            } else if (message.data?.type === 'inventory_change') {
              console.log('Updating specific drink:', message.data);
              // Always refresh the full drinks list to ensure consistency
              queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
              if (message.data?.drinkId) {
                queryClient.invalidateQueries({ 
                  queryKey: [`/api/drinks/${message.data.drinkId}`]
                });
              }
            }
            break;

          case 'POUR_UPDATE':
            console.log('Updating pour-related data');
            queryClient.invalidateQueries({ queryKey: ['/api/pour-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['/api/pour-transactions'] });
            break;

          case 'status':
            console.log('WebSocket status:', message.status);
            if (message.status === 'connected') {
              reconnectAttemptsRef.current = 0;
            }
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
      reconnectAttemptsRef.current = 0;
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

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${reconnectAttemptsRef.current})...`);
      connect();
    }, delay);
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