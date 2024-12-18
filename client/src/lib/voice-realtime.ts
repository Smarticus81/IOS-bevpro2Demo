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
  private static instance: RealtimeVoiceSynthesis;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private messageQueue: string[] = [];
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    super();
    // Initialize Web Audio API context on first user interaction
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new AudioContext();
          console.log('Audio context initialized on user interaction');
          // After audio context is initialized, attempt WebSocket connection
          this.connectionPromise = this.connect().catch(error => {
            console.error('Failed to establish connection:', error);
            this.emit<VoiceError>('error', {
              type: 'synthesis',
              message: 'Failed to initialize voice synthesis'
            });
          });
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          this.emit<VoiceError>('error', {
            type: 'synthesis',
            message: 'Failed to initialize audio playback'
          });
        }
      }
    };

    // Handle both click and touch events for mobile
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
  }

  static getInstance(): RealtimeVoiceSynthesis {
    if (!RealtimeVoiceSynthesis.instance) {
      RealtimeVoiceSynthesis.instance = new RealtimeVoiceSynthesis();
    }
    return RealtimeVoiceSynthesis.instance;
  }

  private async initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
        console.log('Audio context initialized');
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        throw new Error('Could not initialize audio playback');
      }
    }
    return this.audioContext;
  }

  private async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (!this.audioContext) {
      throw new Error('Audio context must be initialized before connecting');
    }

    try {
      console.log('Initializing WebSocket connection...');
      
      // Get OpenAI API key from server first to ensure we have credentials
      const client = await getOpenAIClient().catch(error => {
        console.error('Failed to initialize OpenAI client:', error);
        throw new Error('OpenAI client initialization failed');
      });

      // Connect to our server's WebSocket proxy instead of OpenAI directly
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/realtime`;
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }
      
      // Close any existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.processQueue();
      };

      this.ws.onclose = (event) => {
        console.log('Disconnected from OpenAI Realtime API:', event.code, event.reason);
        this.isConnected = false;
        this.clearQueue(); // Clear any pending messages
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit<VoiceError>('error', {
          type: 'synthesis',
          message: 'Voice synthesis connection error'
        });
      };

      this.ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Handle binary audio data
            if (!this.audioContext) {
              console.warn('Audio context not initialized');
              return;
            }

            const arrayBuffer = await event.data.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioQueue.push(audioBuffer);
            
            if (!this.isPlaying) {
              await this.playNextChunk();
            }
          } else {
            // Handle JSON messages
            const data = JSON.parse(event.data);
            console.log('Received message:', data);
            
            if (data.type === 'error') {
              this.emit<VoiceError>('error', {
                type: 'synthesis',
                message: data.error || 'Unknown synthesis error'
              });
            } else if (data.type === 'status') {
              console.log('WebSocket status:', data.status);
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          this.emit<VoiceError>('error', {
            type: 'synthesis',
            message: 'Failed to process audio data'
          });
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
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) after ${delay}ms`);
      
      setTimeout(async () => {
        try {
          await this.connect();
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          // Only emit error on final attempt
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit<VoiceError>('error', {
              type: 'synthesis',
              message: 'Failed to connect to voice synthesis service after multiple attempts'
            });
          }
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Failed to connect to voice synthesis service after multiple attempts'
      });
    }
  }

  private async processQueue() {
    if (!this.isConnected || this.messageQueue.length === 0) return;
    
    try {
      while (this.messageQueue.length > 0) {
        const text = this.messageQueue[0]; // Peek at the next message
        if (!text || this.ws?.readyState !== WebSocket.OPEN) break;
        
        console.log('Processing text:', text);
        const event = {
          type: "audio.create",
          audio: {
            text,
            voice: "alloy",
            model: "tts-1",
            stream: true
          }
        };
        
        await new Promise<void>((resolve, reject) => {
          if (!this.ws) {
            reject(new Error('WebSocket not available'));
            return;
          }
          
          try {
            this.ws.send(JSON.stringify(event));
            // Only remove the message from queue after successful send
            this.messageQueue.shift();
            resolve();
          } catch (error) {
            console.error('Failed to send message:', error);
            reject(error);
          }
        });
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Failed to process voice synthesis queue'
      });
    }
  }

  async speak(text: string) {
    if (!text) {
      console.warn('Empty text provided to speak');
      return;
    }

    console.log('Queueing text for synthesis:', text);
    this.messageQueue.push(text);
    
    if (this.isConnected) {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Error in speak:', error);
        throw error;
      }
    } else {
      console.log('Not connected, message queued for later processing');
    }
  }

  clearQueue() {
    this.messageQueue = [];
  }

  private async playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    if (!this.audioContext) {
      console.warn('Audio context not available');
      return;
    }

    try {
      this.isPlaying = true;
      const buffer = this.audioQueue.shift()!;
      const source = this.audioContext.createBufferSource();
      
      // Create a gain node for smooth fade in/out
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.audioContext.destination);
      
      // Connect source through gain node
      source.connect(gainNode);
      
      // Smooth fade in
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.02);
      
      source.buffer = buffer;
      source.onended = () => {
        // Cleanup
        source.disconnect();
        gainNode.disconnect();
        
        // Play next chunk if available
        if (this.audioQueue.length > 0) {
          this.playNextChunk();
        } else {
          this.isPlaying = false;
        }
      };
      
      source.start();
      console.log('Started playing audio chunk');
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.isPlaying = false;
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Failed to play audio'
      });
    }
  }
}

export const realtimeVoiceSynthesis = RealtimeVoiceSynthesis.getInstance();
