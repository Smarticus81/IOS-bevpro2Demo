import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true
  });

  // Handle upgrade manually to properly handle protocols
  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const wsProtocol = request.headers['sec-websocket-protocol'];

    // Skip vite HMR connections
    if (wsProtocol?.includes('vite-hmr')) {
      return;
    }

    // Handle WebSocket connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to realtime proxy');

    // Send initial connection status
    ws.send(JSON.stringify({
      type: 'status',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);

        // Broadcast message to all connected clients except sender
        const broadcastData = JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        });

        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
          }
        });
      } catch (error) {
        console.error('Failed to process message:', error);

        // Send error back to client
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to process message',
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle client disconnection
    ws.on('close', () => {
      console.log('Client disconnected from realtime proxy');
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return {
    wss,
    broadcast: (message: any) => {
      const broadcastData = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      });

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastData);
        }
      });
    }
  };
}