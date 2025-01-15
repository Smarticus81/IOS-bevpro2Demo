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
    const statusMessage = JSON.stringify({
      type: 'status',
      status: 'connected',
      timestamp: new Date().toISOString()
    });

    try {
      ws.send(statusMessage);
    } catch (error) {
      console.error('Error sending initial status:', error);
    }

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);

        // Add timestamp if not present
        const broadcastMessage = {
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        };

        // Broadcast to all other clients
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify(broadcastMessage));
            } catch (error) {
              console.error('Error broadcasting to client:', error);
            }
          }
        });
      } catch (error) {
        console.error('Failed to process message:', error);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process message',
            timestamp: new Date().toISOString()
          }));
        } catch (sendError) {
          console.error('Error sending error message:', sendError);
        }
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from realtime proxy');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  const broadcast = async (message: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Ensure message has required fields
        const broadcastMessage = {
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        };

        const messageStr = JSON.stringify(broadcastMessage);
        console.log('Broadcasting message:', broadcastMessage);

        // Track successful broadcasts
        let successCount = 0;
        const totalClients = wss.clients.size;

        if (totalClients === 0) {
          console.log('No connected clients to broadcast to');
          resolve();
          return;
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(messageStr, (error) => {
                if (error) {
                  console.error('Error sending to client:', error);
                } else {
                  successCount++;
                }

                // Resolve when all messages have been attempted
                if (successCount === totalClients) {
                  console.log(`Successfully broadcast to ${successCount}/${totalClients} clients`);
                  resolve();
                }
              });
            } catch (error) {
              console.error('Failed to send message to client:', error);
              if (successCount === totalClients) {
                resolve();
              }
            }
          } else {
            if (successCount === totalClients) {
              resolve();
            }
          }
        });
      } catch (error) {
        console.error('Broadcast error:', error);
        reject(error);
      }
    });
  };

  return {
    wss,
    broadcast
  };
}