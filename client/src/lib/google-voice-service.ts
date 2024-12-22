interface VoiceRecognitionCallback {
  (text: string): void;
}

class GoogleVoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: VoiceRecognitionCallback | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Defer initialization until actually needed
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
    }
  }

  private initializeSpeechRecognition() {
    if (this.isInitialized) return;

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
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      // Configure event handlers
      this.recognition.onresult = (event) => {
        try {
          if (event.results && event.results[0] && event.results[0][0]) {
            const text = event.results[0][0].transcript;
            console.log('Voice command recognized:', text);
            if (this.callback) {
              this.callback(text);
            }
          }
        } catch (error) {
          console.error('Error processing speech result:', error);
          this.handleError(error);
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.handleError(new Error(`Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        console.log('Speech recognition ended');
        this.isListening = false;
        // Notify callback of end if needed
        if (this.callback) {
          this.callback('');
        }
      };

      this.isInitialized = true;
      console.log('Speech recognition initialized successfully');
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.handleError(error);
    }
  }

  private handleError(error: Error) {
    this.isListening = false;
    if (this.callback) {
      this.callback('');
    }
  }

  async startListening(callback: VoiceRecognitionCallback): Promise<void> {
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

        // Setup one-time success handler
        const onStart = () => {
          this.recognition?.removeEventListener('start', onStart);
          this.isListening = true;
          console.log('Started listening for voice commands');
          resolve();
        };

        // Setup one-time error handler
        const onError = (event: ErrorEvent) => {
          this.recognition?.removeEventListener('error', onError);
          reject(new Error(`Failed to start speech recognition: ${event.error}`));
        };

        this.recognition.addEventListener('start', onStart);
        this.recognition.addEventListener('error', onError);
        this.recognition.start();
      });
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

        // Setup one-time handlers
        const onStop = () => {
          this.recognition?.removeEventListener('end', onStop);
          resolve();
        };

        const onError = (event: ErrorEvent) => {
          this.recognition?.removeEventListener('error', onError);
          reject(new Error(`Failed to stop speech recognition: ${event.error}`));
        };

        this.recognition.addEventListener('end', onStop);
        this.recognition.addEventListener('error', onError);
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

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// Export a singleton instance
export const googleVoiceService = new GoogleVoiceService();
