import { type VoiceRecognitionCallback, type VoiceError } from "@/types/speech";

class GoogleVoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: VoiceRecognitionCallback | null = null;
  private isInitialized: boolean = false;
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;
  private restartTimeout: NodeJS.Timeout | null = null;
  private isManualStop: boolean = false;
  private isPaused: boolean = false;

  constructor() {
    console.log('GoogleVoiceService constructor called');
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
      if (typeof window === 'undefined') {
        console.warn('Speech recognition is only available in browser environments');
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported in this browser');
        return;
      }
      this.recognition = new SpeechRecognition();
      this.setupRecognitionConfig();
      this.setupEventHandlers();
      this.isInitialized = true;
      console.log('Speech recognition initialized successfully');
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      const err = error instanceof Error ? error : new Error('Failed to initialize speech recognition');
      this.handleError(err);
    }
  }

  private setupRecognitionConfig() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.isManualStop = false;
      this.isPaused = false;
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;
      }
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');

      // Only attempt to restart if we're still supposed to be listening
      // and it wasn't manually stopped and not paused
      if (this.isListening && !this.isManualStop && !this.isPaused) {
        console.log('Attempting to restart speech recognition...');
        try {
          this.recognition?.start();
        } catch (error) {
          console.error('Failed to restart speech recognition immediately, trying with delay:', error);

          // If immediate restart fails, try with a minimal delay
          if (!this.restartTimeout) {
            this.restartTimeout = setTimeout(() => {
              if (this.isListening && this.callback && !this.isManualStop && !this.isPaused) {
                console.log('Attempting delayed restart of speech recognition...');
                try {
                  this.recognition?.start();
                } catch (error) {
                  console.error('Failed to restart speech recognition:', error);
                  this.isListening = false;
                  this.callback = null;
                }
              }
              this.restartTimeout = null;
            }, 50);
          }
        }
      } else {
        console.log('Not restarting recognition:', {
          isListening: this.isListening,
          isManualStop: this.isManualStop,
          isPaused: this.isPaused
        });
      }
    };

    this.recognition.onerror = this.handleRecognitionError.bind(this);
    this.recognition.onresult = this.handleRecognitionResult.bind(this);

    this.recognition.onaudiostart = () => console.log('Audio capturing started');
    this.recognition.onaudioend = () => console.log('Audio capturing ended');
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

    // Don't treat these errors as fatal
    const nonFatalErrors = ['no-speech', 'audio-capture', 'network', 'aborted'];
    if (nonFatalErrors.includes(event.error)) {
      console.log(`Non-fatal error "${event.error}" detected, continuing to listen...`);
      return;
    }

    // For fatal errors, stop listening
    this.handleError(new Error(`Speech recognition error: ${event.error}`));
  }

  private handleError(error: Error) {
    console.error('Voice service error:', error);
    this.isListening = false;
    if (this.callback) {
      this.callback('');
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }

  async startListening(callback: VoiceRecognitionCallback): Promise<void> {
    console.log('Starting voice recognition...');

    if (!this.isInitialized) {
      this.initializeSpeechRecognition();
    }

    if (!this.recognition) {
      throw new Error('Speech recognition is not available');
    }

    if (this.isListening && !this.isPaused) {
      console.warn('Already listening for voice commands');
      return;
    }

    try {
      this.callback = callback;
      this.isManualStop = false;
      this.isPaused = false;

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
          if (this.recognition) {
            this.recognition.onstart = this.setupEventHandlers.bind(this);
          }
          resolve();
        };

        const onError = (event: SpeechRecognitionErrorEvent) => {
          clearTimeout(startTimeout);
          if (this.recognition) {
            this.recognition.onstart = this.setupEventHandlers.bind(this);
          }
          reject(new Error(`Failed to start speech recognition: ${event.error}`));
        };

        this.recognition.onstart = onStart;
        this.recognition.onerror = onError;

        try {
          this.recognition.start();
        } catch (error) {
          clearTimeout(startTimeout);
          reject(error);
        }
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
      // Mark this as a manual stop
      this.isManualStop = true;
      this.isPaused = false;

      // Clear any pending restart timeout
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;
      }

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
          if (this.recognition) {
            this.recognition.onend = this.setupEventHandlers.bind(this);
          }
          resolve();
        };

        const onError = (event: SpeechRecognitionErrorEvent) => {
          clearTimeout(stopTimeout);
          if (this.recognition) {
            this.recognition.onend = this.setupEventHandlers.bind(this);
          }
          reject(new Error(`Failed to stop speech recognition: ${event.error}`));
        };

        this.recognition.onend = onEnd;
        this.recognition.onerror = onError;

        try {
          this.recognition.stop();
        } catch (error) {
          clearTimeout(stopTimeout);
          reject(error);
        }
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

  async pauseListening(): Promise<void> {
    if (!this.isListening || !this.recognition) return;

    try {
      this.isPaused = true;
      await this.recognition.stop();
      console.log('Speech recognition paused');
    } catch (error) {
      console.error('Error pausing speech recognition:', error);
      throw error;
    }
  }

  async resumeListening(): Promise<void> {
    if (!this.isPaused || !this.callback) return;

    try {
      this.isPaused = false;
      await this.startListening(this.callback);
      console.log('Speech recognition resumed');
    } catch (error) {
      console.error('Error resuming speech recognition:', error);
      throw error;
    }
  }

  getCurrentCallback(): VoiceRecognitionCallback | null {
    return this.callback;
  }

  isActive(): boolean {
    return this.isListening && !this.isPaused;
  }

  isPausing(): boolean {
    return this.isPaused;
  }

  isSupported(): boolean {
    if (!this.isInitialized) {
      this.initializeSpeechRecognition();
    }
    return this.isInitialized && this.recognition !== null;
  }
}

// Export a singleton instance
export const googleVoiceService = new GoogleVoiceService();