import type { VoiceSettings } from '@/types/speech';

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

export type VoiceProvider = 'openai';

export interface VoiceOptions {
  voice?: string;
  speed?: number;
}

class VoiceProviders {
  private static instance: VoiceProviders;
  private audioContext: AudioContext | null = null;
  private audioContextInitialized = false;
  
  private constructor() {
    // Initialize audio context on first user interaction
    const initAudioContext = () => {
      if (!this.audioContextInitialized) {
        console.log('Initializing AudioContext...');
        this.audioContext = new AudioContext();
        this.audioContextInitialized = true;
        console.log('AudioContext initialized:', {
          state: this.audioContext.state,
          sampleRate: this.audioContext.sampleRate,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Set up multiple triggers for audio context initialization
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
    document.addEventListener('keydown', initAudioContext, { once: true });
  }

  static getInstance(): VoiceProviders {
    if (!VoiceProviders.instance) {
      VoiceProviders.instance = new VoiceProviders();
    }
    return VoiceProviders.instance;
  }

  async synthesize(text: string, options: VoiceOptions = {}): Promise<ArrayBuffer> {
    console.log('Synthesizing speech:', {
      text,
      options,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: options.voice || 'nova',
          speed: options.speed || 1.0
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI synthesis error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI synthesis failed: ${response.status} - ${errorText}`);
      }

      const audioData = await response.arrayBuffer();
      if (!audioData || audioData.byteLength === 0) {
        throw new Error('Received empty audio data from server');
      }

      console.log('OpenAI synthesis succeeded:', {
        audioSize: audioData.byteLength,
        timestamp: new Date().toISOString()
      });

      return audioData;
    } catch (error) {
      console.error('Voice synthesis error:', error);
      throw error;
    }
  }

  async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      return new Promise((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      throw new Error('Failed to play audio');
    }
  }
}

export const voiceProviders = VoiceProviders.getInstance();