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

class RealtimeVoiceService extends EventHandler {
  private static instance: RealtimeVoiceService;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isConnected = false;
  private messageQueue: string[] = [];
  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    super();
    this.initializeAudioContext();
  }

  static getInstance(): RealtimeVoiceService {
    if (!RealtimeVoiceService.instance) {
      RealtimeVoiceService.instance = new RealtimeVoiceService();
    }
    return RealtimeVoiceService.instance;
  }

  private initializeAudioContext() {
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new AudioContext();
          this.audioElement = document.createElement('audio');
          this.audioElement.autoplay = true;
          console.log('Audio context initialized on user interaction');
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          this.emit<VoiceError>('error', {
            type: 'synthesis',
            message: 'Failed to initialize audio playback'
          });
        }
      }
    };

    // Initialize on user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
  }

  private async getEphemeralKey(): Promise<string> {
    try {
      const response = await fetch('/api/session');
      const data = await response.json();
      return data.client_secret.value;
    } catch (error) {
      console.error('Failed to get ephemeral key:', error);
      throw new Error('Could not obtain session key');
    }
  }

  private async setupPeerConnection() {
    console.log('Setting up audio connection...');
    if (!this.audioContext || !this.audioElement) {
      console.error('Audio context or element not initialized');
      throw new Error('Audio context not initialized');
    }

    try {
      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection();

      // Set up audio stream handling
      this.peerConnection.ontrack = (event) => {
        if (this.audioElement) {
          this.audioElement.srcObject = event.streams[0];
        }
      };

      // Add local audio track for microphone input
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, mediaStream);
      });

      // Set up data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannelHandlers();

      // Create and set local description
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Get ephemeral key and establish connection
      const ephemeralKey = await this.getEphemeralKey();
      console.log('Initializing audio streaming...');
      const response = await fetch('/api/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Failed to initialize audio session:', response.status);
        throw new Error('Failed to initialize audio session');
      }

      const audioData = await response.blob();
      if (this.audioElement) {
        const audioUrl = URL.createObjectURL(audioData);
        this.audioElement.src = audioUrl;
        console.log('Audio streaming initialized successfully');
      }

      if (!response.ok) {
        throw new Error(`Failed to connect to Realtime API: ${response.status}`);
      }

      const answer = {
        type: 'answer',
        sdp: await response.text()
      };

      await this.peerConnection.setRemoteDescription(answer as RTCSessionDescriptionInit);
      this.isConnected = true;
      console.log('WebRTC connection established successfully');

    } catch (error) {
      console.error('Failed to setup WebRTC connection:', error);
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Failed to initialize voice service'
      });
      throw error;
    }
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.processQueue();
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.isConnected = false;
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit<VoiceError>('error', {
        type: 'synthesis',
        message: 'Voice service communication error'
      });
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);
        
        if (message.type === 'error') {
          this.emit<VoiceError>('error', {
            type: 'synthesis',
            message: message.error || 'Unknown synthesis error'
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  }

  private async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.setupPeerConnection();
    return this.connectionPromise;
  }

  private async processQueue() {
    if (!this.isConnected || !this.dataChannel || this.messageQueue.length === 0) return;

    try {
      while (this.messageQueue.length > 0) {
        const text = this.messageQueue[0];
        if (!text) break;

        const event = {
          type: 'response.create',
          response: {
            modalities: ['text', 'speech'],
            instructions: text,
            voice: 'nova'
          }
        };

        this.dataChannel.send(JSON.stringify(event));
        this.messageQueue.shift();
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

    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        console.error('Connection failed:', error);
        throw error;
      }
    }

    await this.processQueue();
  }

  async disconnect() {
    this.messageQueue = [];
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }
}

export const realtimeVoiceService = RealtimeVoiceService.getInstance();
