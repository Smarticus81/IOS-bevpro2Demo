import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/realtime',
    clientTracking: true,
    // Skip WebSocket protocol check for vite HMR
    verifyClient: (info: { req: IncomingMessage }) => {
      return !info.req.headers['sec-websocket-protocol']?.includes('vite-hmr');
    }
  });

  wss.on('connection', async (ws, req) => {
    console.log('Client connected to realtime proxy');
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      // Connect to OpenAI's realtime API
      const openaiWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        [
          "realtime",
          // Auth
          `openai-api-key.${process.env.OPENAI_API_KEY}`,
          // Beta protocol, required
          "openai-beta.realtime-v1"
        ]
      );

      // Set up error handlers first
      openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'error',
            error: 'Connection to OpenAI failed'
          }));
        }
      });

      openaiWs.on('close', (code, reason) => {
        console.log('OpenAI WebSocket closed:', code, reason.toString());
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      // Wait for connection before sending ready status
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('OpenAI WebSocket connection timeout'));
        }, 10000);

        openaiWs.on('open', () => {
          clearTimeout(timeout);
          console.log('Connected to OpenAI Realtime API');
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
          }
          resolve(undefined);
        });
      });

      // Handle messages from OpenAI
      openaiWs.on('message', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle messages from client
      ws.on('message', (data) => {
        if (openaiWs.readyState === WebSocket.OPEN) {
          try {
            const message = JSON.parse(data.toString());
            console.log('Client message:', message);
            openaiWs.send(JSON.stringify(message));
          } catch (error) {
            console.error('Failed to parse client message:', error);
          }
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected from realtime proxy');
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.close();
        }
      });
    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to initialize connection'
        }));
        ws.close();
      }
    }
  });

  return wss;
}
