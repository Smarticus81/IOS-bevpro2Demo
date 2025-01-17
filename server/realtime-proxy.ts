import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true,
    pingInterval: 30000,
    pingTimeout: 5000
  });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const wsProtocol = request.headers['sec-websocket-protocol'];

    if (wsProtocol?.includes('vite-hmr')) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to realtime proxy');

    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    ws.send(JSON.stringify({
      type: 'status',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      console.log('Client disconnected from realtime proxy');
      clearInterval(pingInterval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Connection error occurred',
          timestamp: new Date().toISOString()
        }));
      }
    });
  });

  return wss;
}

export function broadcastUpdate(wss: WebSocketServer, type: string, data: any) {
  if (!wss) return;

  const message = JSON.stringify({
    type,
    ...data,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}