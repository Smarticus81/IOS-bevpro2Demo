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
  private currentMode: 'order' | 'inquiry' = 'order';
  private elevenLabsInitialized = false;

  private constructor() {
    super();
    // Initialize Web Audio API context on first user interaction
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('Audio context initialized on user interaction');
          // Try to initialize Eleven Labs
          this.initializeElevenLabs().catch(error => {
            console.warn('Eleven Labs initialization failed, will use Web Speech API fallback:', error);
          });
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

  private async initializeElevenLabs() {
    try {
      console.log('Checking Eleven Labs configuration...');
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Config API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.elevenLabsKey) {
        this.elevenLabsInitialized = true;
        console.log('Eleven Labs initialized successfully');
      } else {
        console.log('No Eleven Labs API key found, will use Web Speech API');
      }
    } catch (error) {
      console.warn('Failed to initialize Eleven Labs:', error);
      this.elevenLabsInitialized = false;
    }
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

    console.log('Processing speech request:', {
      text,
      mode: this.currentMode,
      elevenLabsAvailable: this.elevenLabsInitialized
    });

    try {
      // Only use Eleven Labs in inquiry mode when available
      if (this.currentMode === 'inquiry' && this.elevenLabsInitialized) {
        try {
          await this.synthesizeWithElevenLabs(text);
        } catch (error) {
          console.warn('Eleven Labs synthesis failed, falling back to Web Speech:', error);
          await this.synthesizeWithWebSpeech(text);
        }
      } else {
        await this.synthesizeWithWebSpeech(text);
      }
    } catch (error) {
      console.error('Speech synthesis failed:', error);
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to synthesize speech'
        }
      }));
      throw error;
    }
  }

  private async synthesizeWithElevenLabs(text: string) {
    console.log('Using Eleven Labs for synthesis');
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
      throw new Error(`Eleven Labs synthesis failed: ${response.statusText}`);
    }

    const audioData = await response.arrayBuffer();
    await this.playAudioBuffer(audioData);
  }

  private synthesizeWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Using Web Speech API for synthesis');
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure utterance
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to use a female voice if available
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('karen')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onend = () => {
        console.log('Web Speech synthesis completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Web Speech synthesis error:', event);
        reject(new Error('Web Speech synthesis failed'));
      };

      window.speechSynthesis.speak(utterance);
    });
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