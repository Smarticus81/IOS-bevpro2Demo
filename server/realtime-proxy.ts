import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

export function setupRealtimeProxy(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true
  });

  // Handle upgrade manually to properly handle protocols
  server.on('upgrade', (request, socket, head) => {
    const wsProtocol = request.headers['sec-websocket-protocol'];
    
    // Skip vite HMR connections
    if (wsProtocol?.includes('vite-hmr')) {
      return;
    }

    // Only handle /api/realtime path
    if (request.url?.startsWith('/api/realtime')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws, req) => {
    console.log('Client connected to realtime proxy');
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      // Connect to OpenAI's TTS realtime API
      const openaiWs = new WebSocket(
        "wss://api.openai.com/v1/audio/speech",
        [
          // Auth
          `Bearer ${process.env.OPENAI_API_KEY}`,
          // Audio streaming protocol
          "audio.speech.beta.1"
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
            
            if (message.type === 'synthesis') {
              // Send TTS request to OpenAI
              openaiWs.send(JSON.stringify({
                model: "tts-1",
                voice: message.voice || "alloy",
                input: message.text,
                speed: message.speed || 1.2,
                stream: true
              }));
            }
          } catch (error) {
            console.error('Failed to parse client message:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Invalid message format'
            }));
          }
        }
      });

      // Handle binary audio data from OpenAI
      openaiWs.binaryType = 'arraybuffer';
      openaiWs.onmessage = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (event.data instanceof ArrayBuffer) {
            // Send audio chunk to client
            ws.send(JSON.stringify({
              type: 'audio',
              chunk: Buffer.from(event.data).toString('base64')
            }));
          } else {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'end') {
                ws.send(JSON.stringify({ type: 'end' }));
              }
            } catch (error) {
              console.error('Failed to parse OpenAI message:', error);
            }
          }
        }
      };

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
