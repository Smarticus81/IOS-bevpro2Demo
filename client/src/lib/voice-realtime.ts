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
      // Use Eleven Labs when initialized, regardless of mode
      if (this.elevenLabsInitialized) {
        try {
          console.log('Attempting Eleven Labs synthesis...');
          await this.synthesizeWithElevenLabs(text);
        } catch (error) {
          console.warn('Eleven Labs synthesis failed, falling back to Web Speech:', error);
          await this.synthesizeWithWebSpeech(text);
        }
      } else {
        console.log('Using Web Speech API as fallback...');
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

  // Cache for available voices
  private cachedVoices: SpeechSynthesisVoice[] | null = null;
  private isWebKit = /webkit/i.test(navigator.userAgent);

  private async synthesizeWithWebSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Using Web Speech API for synthesis');
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure base settings
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const initVoices = () => {
        try {
          // Get available voices
          const voices = this.cachedVoices || window.speechSynthesis.getVoices();
          if (!this.cachedVoices && voices.length > 0) {
            this.cachedVoices = voices;
          }
          console.log('Available voices:', voices.length);

          // Define preferred voices and languages
          const preferredVoices = [
            { name: /samantha/i, lang: 'en-US' },
            { name: /karen/i, lang: 'en-GB' },
            { name: /female/i, lang: 'en' }
          ];

          // Try to find a matching voice
          let selectedVoice = null;
          for (const pref of preferredVoices) {
            selectedVoice = voices.find(voice =>
              pref.name.test(voice.name.toLowerCase()) &&
              voice.lang.startsWith(pref.lang)
            );
            if (selectedVoice) {
              console.log('Found preferred voice:', selectedVoice.name);
              break;
            }
          }

          // Fallback to any English voice if no preferred voice found
          if (!selectedVoice) {
            selectedVoice = voices.find(voice =>
              voice.lang.startsWith('en') &&
              (this.isWebKit ? true : voice.localService) // Don't restrict to local voices in WebKit
            );
            if (selectedVoice) {
              console.log('Using fallback English voice:', selectedVoice.name);
            }
          }

          // Last resort: use any available voice
          if (!selectedVoice && voices.length > 0) {
            selectedVoice = voices[0];
            console.log('Using default voice:', selectedVoice.name);
          }

          if (selectedVoice) {
            console.log('Voice selected:', {
              name: selectedVoice.name,
              lang: selectedVoice.lang,
              local: selectedVoice.localService,
              isWebKit: this.isWebKit
            });
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
          } else {
            console.warn('No suitable voice found, using system default');
            utterance.lang = 'en-US'; // Fallback language
          }

          // Handle WebKit specific issues
          if (this.isWebKit) {
            console.log('Applying WebKit-specific handling');
            window.speechSynthesis.cancel(); // Clear any stuck utterances

            // Add slight delay for WebKit
            setTimeout(() => {
              window.speechSynthesis.speak(utterance);
            }, 100);
          } else {
            window.speechSynthesis.speak(utterance);
          }
        } catch (error) {
          console.error('Voice initialization error:', error);
          reject(error);
        }
      };

      // Event handlers with improved logging
      utterance.onstart = () => {
        console.log('Speech synthesis started:', {
          voice: utterance.voice?.name || 'default',
          lang: utterance.lang,
          timestamp: new Date().toISOString()
        });
      };

      utterance.onend = () => {
        console.log('Speech synthesis completed');
        if (this.isWebKit) {
          window.speechSynthesis.cancel(); // Ensure clean state for WebKit
        }
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', {
          error: event.error,
          message: event.message,
          elapsedTime: event.elapsedTime,
          timestamp: new Date().toISOString()
        });

        if (this.isWebKit) {
          window.speechSynthesis.cancel(); // Clean up on error
        }

        reject(new Error(`Web Speech synthesis failed: ${event.error}`));
      };

      // Handle voice initialization with retry
      const tryInitVoices = (retryCount = 0) => {
        // Start voice initialization process
        if (this.isWebKit) {
          // WebKit browsers: try immediate initialization with retry
          if (this.cachedVoices?.length > 0 || window.speechSynthesis.getVoices().length > 0) {
            initVoices();
          } else if (retryCount < 3) { // Retry up to 3 times
            console.log(`Retrying voice initialization (${retryCount + 1}/3)...`);
            setTimeout(() => tryInitVoices(retryCount + 1), 100 * Math.pow(2, retryCount));
          } else {
            console.warn('Failed to initialize voices after retries');
            initVoices(); // Try one last time with whatever we have
          }
        } else {
          // Other browsers: use standard onvoiceschanged event
          if (window.speechSynthesis.getVoices().length > 0) {
            initVoices();
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              window.speechSynthesis.onvoiceschanged = null; // Clean up listener
              initVoices();
            };
          }
        }
      };
      tryInitVoices();
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