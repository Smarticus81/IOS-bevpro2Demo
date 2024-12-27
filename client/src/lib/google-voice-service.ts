import { type VoiceRecognitionCallback, type VoiceError } from "@/types/speech";

class GoogleVoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: VoiceRecognitionCallback | null = null;
  private isInitialized: boolean = false;
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;
  private isManualStop: boolean = false;
  private isPaused: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
    }
  }

  private initializeSpeechRecognition() {
    if (this.isInitialized || this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
      return;
    }

    this.initializationAttempts++;
    try {
      if (typeof window === 'undefined') return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      this.recognition = new SpeechRecognition();
      this.setupRecognitionConfig();
      this.setupEventHandlers();
      this.isInitialized = true;
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
      this.isListening = true;
      this.isManualStop = false;
      this.isPaused = false;
    };

    this.recognition.onend = () => {
      if (this.isListening && !this.isManualStop && !this.isPaused) {
        try {
          this.recognition?.start();
        } catch (error) {
          console.error('Failed to restart speech recognition:', error);
          this.isListening = false;
          this.callback = null;
        }
      }
    };

    this.recognition.onerror = this.handleRecognitionError.bind(this);
    this.recognition.onresult = this.handleRecognitionResult.bind(this);
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent) {
    try {
      const results = event.results;
      if (results && results.length > 0) {
        const result = results[results.length - 1];
        if (result.isFinal) {
          const text = result[0].transcript;
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
    const nonFatalErrors = ['no-speech', 'audio-capture', 'network', 'aborted'];
    if (!nonFatalErrors.includes(event.error)) {
      this.handleError(new Error(`Speech recognition error: ${event.error}`));
    }
  }

  private handleError(error: Error) {
    console.error('Voice service error:', error);
    this.isListening = false;
    if (this.callback) {
      this.callback('');
    }
  }

  async startListening(callback: VoiceRecognitionCallback): Promise<void> {
    if (!this.isInitialized) {
      this.initializeSpeechRecognition();
    }

    if (!this.recognition) {
      throw new Error('Speech recognition is not available');
    }

    if (this.isListening && !this.isPaused) {
      return;
    }

    try {
      this.callback = callback;
      this.isManualStop = false;
      this.isPaused = false;
      await this.recognition.start();
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
      this.isManualStop = true;
      this.isPaused = false;
      await this.recognition.stop();
      this.isListening = false;
      this.callback = null;
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      this.isListening = false;
      this.callback = null;
      throw error;
    }
  }

  isActive(): boolean {
    return this.isListening && !this.isPaused;
  }

  isSupported(): boolean {
    if (!this.isInitialized) {
      this.initializeSpeechRecognition();
    }
    return this.isInitialized && this.recognition !== null;
  }
}

export const googleVoiceService = new GoogleVoiceService();