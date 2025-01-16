import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: 'INVENTORY_UPDATE' | 'POUR_UPDATE' | 'TRANSACTION_UPDATE' | 'status';
  data?: any;
  status?: string;
  timestamp: string;
}

export function useWebSocket(): WebSocket | null {
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
        console.log('WebSocket message received:', message.type);

        // Handle different types of updates
        switch (message.type) {
          case 'INVENTORY_UPDATE':
            // Invalidate and refetch inventory-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
            break;

          case 'POUR_UPDATE':
            // Invalidate and refetch pour-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/pour-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['/api/pour-transactions'] });
            break;

          case 'TRANSACTION_UPDATE':
            // Invalidate all relevant transaction and inventory queries
            queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
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
    }, 5000);
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

  return wsRef.current;
}