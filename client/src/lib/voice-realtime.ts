import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";

type EventCallback<T = any> = (data?: T) => void;
type EventMap = { [key: string]: EventCallback[] };

class EventHandler {
  private events: EventMap = {};

  on<T>(event: string, callback: EventCallback<T>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  emit<T>(event: string, data?: T) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

class RealtimeVoiceSynthesis extends EventHandler {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private messageQueue: string[] = [];

  constructor() {
    super();
    this.connect();
  }

  private async connect() {
    try {
      // Get OpenAI API key from server
      const client = await getOpenAIClient();
      if (!client) {
        throw new Error('Failed to initialize OpenAI client');
      }

      const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
      
      this.ws = new WebSocket(url, [
        "realtime",
        // Auth header is handled by the server proxy
        "openai-beta.realtime-v1"
      ]);

      this.ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.processQueue();
      };

      this.ws.onclose = () => {
        console.log('Disconnected from OpenAI Realtime API');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit<VoiceError>('error', {
          type: 'synthesis',
          message: 'Voice synthesis connection error'
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'audio.chunk') {
            this.emit('audioChunk', data.chunk);
          } else if (data.type === 'error') {
            this.emit<VoiceError>('error', {
              type: 'synthesis',
              message: data.error || 'Unknown synthesis error'
            });
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Failed to connect to voice synthesis service'
      });
    }
  }

  private async processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const text = this.messageQueue.shift();
      if (text && this.ws?.readyState === WebSocket.OPEN) {
        const event = {
          type: "audio.create",
          audio: {
            text,
            voice: "alloy",
            model: "tts-1",
            stream: true
          }
        };
        this.ws.send(JSON.stringify(event));
      }
    }
  }

  async speak(text: string) {
    if (!text) return;

    this.messageQueue.push(text);
    if (this.isConnected) {
      await this.processQueue();
    }
  }

  clearQueue() {
    this.messageQueue = [];
  }
}

export const realtimeVoiceSynthesis = new RealtimeVoiceSynthesis();
