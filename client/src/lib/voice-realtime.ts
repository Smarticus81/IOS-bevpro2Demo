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
    const response = await fetch('/api/voice/token');
    if (!response.ok) {
      throw new Error('Failed to get voice token');
    }
    const data = await response.json();
    return data.client_secret.value;
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
  }

  async connect(): Promise<void> {
    try {
      // Cleanup any existing connections
      await this.disconnect();
      
      const token = await this.getEphemeralToken();
      
      // Create peer connection with ICE servers
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      // Set up connection state monitoring
      this.pc.onconnectionstatechange = () => {
        console.log('Connection state:', this.pc?.connectionState);
        if (this.pc?.connectionState === 'failed') {
          this.emit('error', 'WebRTC connection failed');
          this.disconnect();
        }
      };
      
      // Set up audio playback with error handling
      this.pc.ontrack = (e) => {
        try {
          if (this.audioElement && e.streams[0]) {
            this.audioElement.srcObject = e.streams[0];
            console.log('Audio track received:', e.streams[0].getAudioTracks()[0]?.label);
          }
        } catch (error) {
          console.error('Error setting up audio playback:', error);
          this.emit('error', 'Failed to setup audio playback');
        }
      };

      // Request microphone access with proper error handling
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        this.pc.addTrack(this.mediaStream.getTracks()[0], this.mediaStream);
      } catch (error) {
        console.error('Microphone access error:', error);
        throw new Error('Failed to access microphone. Please ensure microphone permissions are granted.');
      }

      // Create data channel with configuration
      this.dc = this.pc.createDataChannel('oai-events', {
        ordered: true
      });
      this.setupDataChannel();

      // Create and set local description
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true
      });
      await this.pc.setLocalDescription(offer);

      // Get remote description from OpenAI
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
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
      this.state.isConnected = true;
      this.emit('connected');
      
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
    }
    if (this.dc) {
      this.dc.close();
    }
    if (this.pc) {
      this.pc.close();
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
  }

  getState(): VoiceServiceState {
    return { ...this.state };
  }

  sendMessage(message: any): void {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(message));
    } else {
      console.error('Data channel not ready');
    }
  }
}

// Export a singleton instance
export const voiceService = new RealtimeVoiceService();
