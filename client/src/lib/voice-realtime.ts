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

    try {
      // Attempt OpenAI Nova voice synthesis first
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
        
        // Fallback to Web Speech API
        console.log('Falling back to Web Speech API');
        await this.synthesizeWithWebSpeech(text);
      }
    } catch (error) {
      console.error('All speech synthesis methods failed:', error);
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to synthesize speech'
        }
      }));
      throw error;
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


  // Cache for available voices
  private cachedVoices: SpeechSynthesisVoice[] | null = null;
  private isWebKit = /webkit/i.test(navigator.userAgent);

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

      const initVoices = () => {
        try {
          // Get available voices
          const voices = window.speechSynthesis.getVoices();
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
            selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
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

          // Clear any ongoing speech synthesis
          window.speechSynthesis.cancel();

          // For WebKit browsers, we need special handling
          if (this.isWebKit) {
            console.log('Applying WebKit-specific handling');
            
            // Reset the synthesis state
            window.speechSynthesis.resume();
            
            // Use a small delay to ensure proper initialization
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

      // Enhanced event handlers
      utterance.onstart = () => {
        console.log('Speech synthesis started:', {
          voice: utterance.voice?.name || 'default',
          lang: utterance.lang,
          timestamp: new Date().toISOString()
        });
      };

      utterance.onend = () => {
        console.log('Speech synthesis completed');
        window.speechSynthesis.resume(); // Ensure synthesis is resumed for next utterance
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', {
          error: event.error,
          elapsedTime: event.elapsedTime,
          timestamp: new Date().toISOString()
        });

        // Try to recover from errors
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        if (this.isWebKit) {
          // For WebKit, try one more time after a short delay
          setTimeout(() => {
            window.speechSynthesis.speak(utterance);
          }, 250);
        } else {
          reject(new Error(`Web Speech synthesis failed: ${event.error}`));
        }
      };

      // Improved voice initialization with better WebKit support
      const tryInitVoices = (retryCount = 0) => {
        const voices = window.speechSynthesis.getVoices();
        
        if (voices.length > 0) {
          initVoices();
          return;
        }

        if (this.isWebKit) {
          // WebKit requires multiple attempts due to async voice loading
          if (retryCount < 5) {
            console.log(`Initializing WebKit voices (attempt ${retryCount + 1}/5)...`);
            setTimeout(() => {
              tryInitVoices(retryCount + 1);
            }, 100 * Math.pow(2, retryCount));
          } else {
            console.warn('WebKit voice initialization timeout, using defaults');
            initVoices();
          }
        } else {
          // Standard browsers: wait for voices to load
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            initVoices();
          };
        }
      };

      // Start voice initialization
      tryInitVoices(0);
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