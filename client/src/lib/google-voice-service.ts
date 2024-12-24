import { type VoiceRecognitionCallback } from "@/types/speech";

// Extend Window interface with WebKit prefixed types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

class GoogleVoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: VoiceRecognitionCallback | null = null;
  private isInitialized: boolean = false;
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

  constructor() {
    console.log('GoogleVoiceService constructor called');
    // Defer initialization until actually needed
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
    }
  }

  private initializeSpeechRecognition() {
    if (this.isInitialized) {
      console.log('Speech recognition already initialized');
      return;
    }

    if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
      console.warn('Maximum initialization attempts reached');
      return;
    }

    this.initializationAttempts++;
    console.log(`Attempting speech recognition initialization (attempt ${this.initializationAttempts})`);

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.warn('Speech recognition is only available in browser environments');
        return;
      }

      // Initialize Web Speech API with proper type checking
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported in this browser');
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      // Configure event handlers with proper TypeScript types
      this.recognition.onresult = this.handleRecognitionResult.bind(this);
      this.recognition.onerror = this.handleRecognitionError.bind(this);
      this.recognition.onend = () => {
        console.log('Speech recognition ended');
        this.isListening = false;
      };
      this.recognition.onstart = () => {
        console.log('Speech recognition started');
        this.isListening = true;
      };
      this.recognition.onaudiostart = () => {
        console.log('Audio capturing started');
      };
      this.recognition.onaudioend = () => {
        console.log('Audio capturing ended');
      };

      this.isInitialized = true;
      console.log('Speech recognition initialized successfully');
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      const err = error instanceof Error ? error : new Error('Failed to initialize speech recognition');
      this.handleError(err);
    }
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent) {
    try {
      const results = event.results;
      if (results && results.length > 0) {
        const result = results[results.length - 1];
        if (result.isFinal) {
          const text = result[0].transcript;
          console.log('Voice command recognized:', text);
          if (this.callback) {
            this.callback(text);
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error processing speech result');
      console.error('Error processing speech result:', err);
      this.handleError(err);
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent) {
    console.error('Speech recognition error:', {
      error: event.error,
      message: event.message,
      timestamp: new Date().toISOString()
    });
    this.handleError(new Error(`Speech recognition error: ${event.error}`));
  }

  private handleError(error: Error) {
    this.isListening = false;
    if (this.callback) {
      this.callback('');
    }
  }

  async startListening(callback: VoiceRecognitionCallback): Promise<void> {
    console.log('Starting voice recognition...');

    // Ensure initialization on first use
    if (!this.isInitialized) {
      this.initializeSpeechRecognition();
    }

    // Check if speech recognition is available
    if (!this.recognition) {
      throw new Error('Speech recognition is not available');
    }

    // Prevent multiple listeners
    if (this.isListening) {
      console.warn('Already listening for voice commands');
      return;
    }

    try {
      this.callback = callback;
      await new Promise<void>((resolve, reject) => {
        if (!this.recognition) {
          reject(new Error('Speech recognition is not available'));
          return;
        }

        const startTimeout = setTimeout(() => {
          reject(new Error('Speech recognition start timeout'));
        }, 5000);

        const onStart = () => {
          clearTimeout(startTimeout);
          resolve();
        };

        const onError = (event: SpeechRecognitionErrorEvent) => {
          clearTimeout(startTimeout);
          reject(new Error(`Failed to start speech recognition: ${event.error}`));
        };

        this.recognition.onstart = onStart;
        this.recognition.onerror = onError;
        this.recognition.start();
      });

      console.log('Started listening for voice commands');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      this.isListening = false;
      this.callback = null;
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening || !this.recognition) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        if (!this.recognition) {
          reject(new Error('Speech recognition is not available'));
          return;
        }

        const stopTimeout = setTimeout(() => {
          reject(new Error('Speech recognition stop timeout'));
        }, 5000);

        const onEnd = () => {
          clearTimeout(stopTimeout);
          resolve();
        };

        const onError = (event: SpeechRecognitionErrorEvent) => {
          clearTimeout(stopTimeout);
          reject(new Error(`Failed to stop speech recognition: ${event.error}`));
        };

        this.recognition.onend = onEnd;
        this.recognition.onerror = onError;
        this.recognition.stop();
      });

      this.isListening = false;
      this.callback = null;
      console.log('Stopped listening for voice commands');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      // Reset state even on error
      this.isListening = false;
      this.callback = null;
      throw error;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  isSupported(): boolean {
    return this.isInitialized && this.recognition !== null;
  }
}

// Export a singleton instance
export const googleVoiceService = new GoogleVoiceService();