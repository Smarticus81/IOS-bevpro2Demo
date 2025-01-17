import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true,
    // Add ping interval to keep connections alive
    pingInterval: 30000,
    pingTimeout: 5000
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

    // Setup heartbeat
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    // Send initial connection status
    ws.send(JSON.stringify({
      type: 'status',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));

    // Set up ping interval
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.log('Client connection dead, terminating');
        ws.terminate();
        return;
      }

      isAlive = false;
      ws.ping();
    }, 30000);

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);

        // Echo back the message to all connected clients
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              ...message,
              timestamp: new Date().toISOString()
            }));
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
      clearInterval(pingInterval);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      // Attempt to send error to client if connection is still open
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Connection error occurred',
          timestamp: new Date().toISOString()
        }));
      }
    });
  });

  // Handle server-wide errors
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return wss;
}

// Helper function to broadcast updates to all connected clients
export function broadcastUpdate(wss: WebSocketServer, type: string, data: any) {
  if (!wss) return;

  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}