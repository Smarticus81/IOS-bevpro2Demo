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

    // Cancel any ongoing speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      // Always try OpenAI Nova first
      try {
        console.log('Using OpenAI Nova voice synthesis:', {
          text: text.substring(0, 100) + '...',
          timestamp: new Date().toISOString()
        });
        
        await this.synthesizeWithOpenAI(text);
        console.log('OpenAI Nova voice synthesis completed successfully');
        return;
      } catch (error) {
        console.error('OpenAI Nova synthesis failed:', {
          error,
          timestamp: new Date().toISOString()
        });
        
        // If OpenAI fails, wait a moment before trying Web Speech API
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('Falling back to Web Speech API');
        await this.synthesizeWithWebSpeech(text);
      }
    } catch (error) {
      console.error('All speech synthesis methods failed:', error);
      // Don't throw the error, just log it and dispatch the event
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


  private async synthesizeWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text) {
        console.warn('Empty text provided to Web Speech synthesis');
        resolve();
        return;
      }
      
      console.log('Using Web Speech API for synthesis:', { text });
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure base settings
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      // Select voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
      ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];

      if (englishVoice) {
        console.log('Selected voice:', englishVoice.name);
        utterance.voice = englishVoice;
      }

      // Event handlers
      utterance.onstart = () => {
        console.log('Speech synthesis started:', {
          voice: utterance.voice?.name || 'default',
          lang: utterance.lang,
          timestamp: new Date().toISOString()
        });
      };

      utterance.onend = () => {
        console.log('Speech synthesis completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', {
          error: event.error,
          elapsedTime: event.elapsedTime,
          timestamp: new Date().toISOString()
        });
        reject(new Error(`Web Speech synthesis failed: ${event.error}`));
      };

      // Clear any ongoing synthesis and speak
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      // Handle voice loading if voices aren't available yet
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const newVoices = window.speechSynthesis.getVoices();
          const newEnglishVoice = newVoices.find(voice => 
            voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
          ) || newVoices.find(voice => voice.lang.startsWith('en')) || newVoices[0];

          if (newEnglishVoice) {
            utterance.voice = newEnglishVoice;
            console.log('Voice loaded and updated:', newEnglishVoice.name);
          }
        };
      }
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