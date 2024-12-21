import { BrowserEventEmitter } from './browser-events';

interface VoiceServiceState {
  isConnected: boolean;
  isListening: boolean;
  error: string | null;
}

class RealtimeVoiceService extends BrowserEventEmitter {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private state: VoiceServiceState = {
    isConnected: false,
    isListening: false,
    error: null,
  };

  constructor() {
    super();
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
  }

  private async getEphemeralToken(): Promise<string> {
    try {
      const response = await fetch('/api/voice/token');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get voice token: ${errorText}`);
      }
      const data = await response.json();
      if (!data.client_secret?.value || !data.client_secret?.expires_at) {
        throw new Error('Invalid token response format');
      }
      
      const now = Math.floor(Date.now() / 1000);
      if (now >= data.client_secret.expires_at - 5) {
        throw new Error('Token expired or about to expire');
      }
      
      return data.client_secret.value;
    } catch (error) {
      console.error('Token fetch error:', error);
      throw error;
    }
  }

  private setupDataChannel() {
    if (!this.dc) return;

    this.dc.onmessage = (event) => {
      try {
        const realtimeEvent = JSON.parse(event.data);
        this.emit('message', realtimeEvent);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.dc.onopen = () => {
      console.log('Data channel opened');
      this.state.isConnected = true;
      this.emit('connected');
    };

    this.dc.onclose = () => {
      console.log('Data channel closed');
      this.state.isConnected = false;
      this.emit('disconnected');
    };

    this.dc.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit('error', 'Data channel error occurred');
    };
  }

  async connect(): Promise<void> {
    try {
      await this.disconnect();
      
      const token = await this.getEphemeralToken();
      
      this.pc = new RTCPeerConnection();

      this.pc.onconnectionstatechange = () => {
        console.log('Connection state:', this.pc?.connectionState);
        if (this.pc?.connectionState === 'failed') {
          this.emit('error', 'WebRTC connection failed');
          this.disconnect();
        }
      };

      // Set up audio playback
      this.pc.ontrack = (e) => {
        if (this.audioElement) {
          this.audioElement.srcObject = e.streams[0];
        }
      };

      // Add local audio track
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        const audioTrack = this.mediaStream.getAudioTracks()[0];
        if (audioTrack) {
          this.pc.addTrack(audioTrack, this.mediaStream);
        }
      } catch (error) {
        console.error('Microphone access error:', error);
        throw new Error('Failed to access microphone. Please ensure microphone permissions are granted.');
      }

      // Set up data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.setupDataChannel();

      // Create and set local description
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      if (!this.pc.localDescription?.sdp) {
        throw new Error('Failed to create local description');
      }

      // Get remote description from OpenAI
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: this.pc.localDescription.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp'
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`Failed to get SDP answer: ${sdpResponse.status} - ${errorText}`);
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };

      await this.pc.setRemoteDescription(answer);
      console.log('WebRTC connection established successfully');
      
    } catch (error) {
      console.error('Connection error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', this.state.error);
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
    this.state.isConnected = false;
    this.state.isListening = false;
    this.emit('disconnected');
  }

  async startListening(): Promise<void> {
    if (!this.state.isConnected) {
      await this.connect();
    }
    this.state.isListening = true;
    this.emit('listening');
  }

  async stopListening(): Promise<void> {
    this.state.isListening = false;
    this.emit('stopped');
    await this.disconnect();
  }

  sendMessage(message: any): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(message));
    } else {
      console.error('Data channel not ready');
      this.emit('error', 'Data channel not ready to send messages');
    }
  }

  getState(): VoiceServiceState {
    return { ...this.state };
  }
}

// Export a singleton instance
export const voiceService = new RealtimeVoiceService();
