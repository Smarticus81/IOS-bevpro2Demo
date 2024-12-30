
import { type VoiceRecognitionCallback, type VoiceError } from "@/types/speech";
import { logger } from "@/lib/logger";

class GoogleVoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: VoiceRecognitionCallback | null = null;
  private readonly RESTART_DELAY = 50;
  private processingCommand = false;
  private commandBuffer: string[] = [];
  private readonly BUFFER_LIMIT = 3;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
    }
  }

  private initializeSpeechRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      this.recognition = new SpeechRecognition();
      this.setupRecognitionConfig();
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize speech recognition:', error);
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
      logger.info('Voice recognition started');
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (error) {
            logger.error('Failed to restart speech recognition:', error);
            this.cleanup();
          }
        }, this.RESTART_DELAY);
      }
    };

    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onresult = this.handleResult.bind(this);
  }

  private handleResult(event: SpeechRecognitionEvent) {
    try {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text && !this.processingCommand) {
          this.bufferCommand(text);
        }
      }
    } catch (error) {
      logger.error('Error processing speech result:', error);
    }
  }

  private bufferCommand(text: string) {
    this.commandBuffer.push(text);
    if (this.commandBuffer.length >= this.BUFFER_LIMIT) {
      this.commandBuffer.shift();
    }
    this.processBufferedCommands();
  }

  private async processBufferedCommands() {
    if (this.processingCommand || !this.callback) return;

    this.processingCommand = true;
    try {
      while (this.commandBuffer.length > 0) {
        const command = this.commandBuffer.shift();
        if (command) {
          await this.callback(command);
        }
      }
    } finally {
      this.processingCommand = false;
    }
  }

  private handleError(event: SpeechRecognitionErrorEvent) {
    const nonFatalErrors = ['no-speech', 'audio-capture', 'network'];
    if (!nonFatalErrors.includes(event.error)) {
      logger.error('Speech recognition error:', event.error);
      this.cleanup();
    }
  }

  private cleanup() {
    this.isListening = false;
    this.callback = null;
    this.commandBuffer = [];
  }

  async startListening(callback: VoiceRecognitionCallback): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    try {
      this.callback = callback;
      await this.recognition.start();
      logger.info('Voice recognition initialized');
    } catch (error) {
      logger.error('Error starting voice recognition:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    try {
      await this.recognition?.stop();
      this.cleanup();
      logger.info('Voice recognition stopped');
    } catch (error) {
      logger.error('Error stopping voice recognition:', error);
      throw error;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  isSupported(): boolean {
    return !!this.recognition;
  }
}

export const googleVoiceService = new GoogleVoiceService();
