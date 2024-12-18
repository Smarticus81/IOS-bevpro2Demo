import { getOpenAIClient } from './openai';
import type { VoiceError } from '@/types/speech';

// Use browser's native WebSocket and EventTarget
declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

class RealtimeVoiceSynthesis extends EventTarget {
  private static instance: RealtimeVoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private ws: WebSocket | null = null;
  private messageQueue: string[] = [];
  private audioQueue: AudioBuffer[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private isPlaying = false;
  private connectionPromise: Promise<void> | null = null;
  private currentMode: 'order' | 'inquiry' = 'order';
  private elevenLabsInitialized = false;

  private constructor() {
    super();
    // Initialize Web Audio API context on first user interaction
    const initAudio = async () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('Audio context initialized on user interaction');
          // Initialize Eleven Labs
          await this.initializeElevenLabs();
          // After audio context is initialized, attempt WebSocket connection
          this.connectionPromise = this.connect().catch(error => {
            console.error('Failed to establish connection:', error);
            this.dispatchEvent(new CustomEvent('error', {
              detail: {
                type: 'synthesis' as const,
                message: 'Failed to initialize voice synthesis'
              }
            }));
            throw error;
          });
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          throw error;
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

  private async initializeElevenLabs() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      if (data.elevenLabsKey) {
        this.elevenLabsInitialized = true;
        console.log('Eleven Labs initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Eleven Labs:', error);
    }
  }

  private async initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context initialized');
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        throw new Error('Could not initialize audio playback');
      }
    }
    return this.audioContext;
  }

  setMode(mode: 'order' | 'inquiry') {
    this.currentMode = mode;
    console.log('Voice synthesis mode set to:', mode);
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
      await getOpenAIClient().catch(error => {
        console.error('Failed to initialize OpenAI client:', error);
        throw new Error('OpenAI client initialization failed');
      });

      // Connect to our server's WebSocket proxy
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
        this.dispatchEvent(new CustomEvent('error', {
          detail: {
            type: 'synthesis' as const,
            message: 'Voice synthesis connection error'
          }
        }));
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          
          if (data.type === 'error') {
            this.dispatchEvent(new CustomEvent('error', {
              detail: {
                type: 'synthesis' as const,
                message: data.error || 'Unknown synthesis error'
              }
            }));
          } else if (data.type === 'audio') {
            console.log('Received audio chunk:', {
              chunkSize: data.chunk.length,
              timestamp: new Date().toISOString()
            });
            
            try {
              // Convert base64 to ArrayBuffer
              const binaryString = atob(data.chunk);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              if (!this.audioContext) {
                throw new Error('Audio context not initialized');
              }

              console.log('Decoding audio data...');
              const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
              console.log('Successfully decoded audio chunk:', {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                timestamp: new Date().toISOString()
              });
              
              this.audioQueue.push(audioBuffer);
              console.log('Added chunk to queue, current queue length:', this.audioQueue.length);
              
              if (!this.isPlaying) {
                console.log('Starting playback of queued audio');
                await this.playNextChunk();
              }
            } catch (decodeError) {
              console.error('Failed to decode audio chunk:', {
                error: decodeError,
                timestamp: new Date().toISOString()
              });
              throw decodeError;
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          this.dispatchEvent(new CustomEvent('error', {
            detail: {
              type: 'synthesis' as const,
              message: 'Failed to process audio data'
            }
          }));
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
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.dispatchEvent(new CustomEvent('error', {
              detail: {
                type: 'synthesis' as const,
                message: 'Failed to connect to voice synthesis service after multiple attempts'
              }
            }));
          }
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to connect to voice synthesis service after multiple attempts'
        }
      }));
    }
  }

  private async processQueue() {
    if (!this.isConnected || this.messageQueue.length === 0) return;
    
    try {
      while (this.messageQueue.length > 0) {
        const text = this.messageQueue[0]; // Peek at the next message
        if (!text || this.ws?.readyState !== WebSocket.OPEN) break;
        
        console.log('Processing text:', text);
        
        this.ws.send(JSON.stringify({
          type: 'synthesis',
          text,
          voice: 'alloy',
          speed: 1.2
        }));
        
        // Only remove the message from queue after successful send
        this.messageQueue.shift();
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to process voice synthesis queue'
        }
      }));
    }
  }

  async speak(text: string) {
    if (!text) {
      console.warn('Empty text provided to speak');
      return;
    }

    console.log('Queueing text for synthesis:', {
      text,
      mode: this.currentMode,
      elevenLabsAvailable: this.elevenLabsInitialized
    });

    if (this.currentMode === 'inquiry' && this.elevenLabsInitialized) {
      try {
        const response = await fetch('/api/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: 'rachel',
            useElevenLabs: true
          }),
        });

        if (!response.ok) {
          throw new Error(`Synthesis failed: ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        if (!this.audioContext) {
          throw new Error('Audio context not initialized');
        }

        const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer);
        this.audioQueue.push(decodedBuffer);
        
        if (!this.isPlaying) {
          await this.playNextChunk();
        }
      } catch (error) {
        console.error('Error using Eleven Labs synthesis:', error);
        // Fallback to OpenAI synthesis
        await this.synthesizeWithOpenAI(text);
      }
    } else {
      await this.synthesizeWithOpenAI(text);
    }
  }

  private async synthesizeWithOpenAI(text: string) {
    this.messageQueue.push(text);
    
    if (this.isConnected) {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Error in OpenAI synthesis:', error);
        throw error;
      }
    } else {
      console.log('Not connected to OpenAI, message queued for later processing');
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
      
      console.log('Playing audio chunk:', {
        sampleRate: buffer.sampleRate,
        duration: buffer.duration,
        numberOfChannels: buffer.numberOfChannels,
        timestamp: new Date().toISOString()
      });

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
        console.log('Audio chunk playback ended');
        // Cleanup
        source.disconnect();
        gainNode.disconnect();
        
        // Play next chunk if available
        if (this.audioQueue.length > 0) {
          this.playNextChunk();
        } else {
          this.isPlaying = false;
          console.log('Finished playing all audio chunks');
        }
      };
      
      // Resume audio context if it's suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('Resumed audio context');
      }
      
      source.start();
      console.log('Started playing audio chunk');
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.isPlaying = false;
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to play audio'
        }
      }));
    }
  }
}

export const realtimeVoiceSynthesis = RealtimeVoiceSynthesis.getInstance();
