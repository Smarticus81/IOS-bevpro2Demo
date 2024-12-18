import type { VoiceError } from '@/types/speech';

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

class RealtimeVoiceSynthesis extends EventTarget {
  private static instance: RealtimeVoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentMode: 'order' | 'inquiry' = 'order';
  
  private constructor() {
    super();
    // Initialize Web Audio API context on first user interaction
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('Audio context initialized on user interaction');
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
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

  setMode(mode: 'order' | 'inquiry') {
    this.currentMode = mode;
    console.log('Voice synthesis mode set to:', mode);
  }

  async speak(text: string) {
    if (!text) {
      console.warn('Empty text provided to speak');
      return;
    }

    console.log('Starting voice synthesis:', {
      text,
      mode: this.currentMode,
      timestamp: new Date().toISOString()
    });

    try {
      await this.synthesizeWithOpenAI(text);
      console.log('OpenAI Nova voice synthesis completed successfully');
    } catch (error) {
      console.error('Voice synthesis failed:', {
        error,
        mode: this.currentMode,
        text,
        timestamp: new Date().toISOString()
      });
      
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to synthesize speech'
        }
      }));
    }
  }

  private async synthesizeWithOpenAI(text: string) {
    console.log('Using OpenAI Nova for synthesis');
    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Nova synthesis failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenAI Nova synthesis failed: ${response.status} - ${errorText}`);
      }

      const audioData = await response.arrayBuffer();
      if (!audioData || audioData.byteLength === 0) {
        throw new Error('Received empty audio data from server');
      }

      console.log('OpenAI Nova synthesis succeeded, playing audio:', {
        audioSize: audioData.byteLength,
        timestamp: new Date().toISOString()
      });

      await this.playAudioBuffer(audioData);
    } catch (error) {
      console.error('OpenAI Nova synthesis error details:', error);
      throw error;
    }
  }

  private async playAudioBuffer(arrayBuffer: ArrayBuffer) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = () => resolve(undefined);
    });
  }
}

export const realtimeVoiceSynthesis = RealtimeVoiceSynthesis.getInstance();