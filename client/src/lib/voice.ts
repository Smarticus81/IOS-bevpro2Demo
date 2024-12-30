import type { ErrorType, VoiceError } from "@/types/speech";
import { soundEffects } from "./sound-effects";
import { logger } from "./logger";

type EventCallback<T = any> = (data: T) => void;
type EventMap = { [key: string]: EventCallback[] };
type ListeningMode = 'wake_word' | 'command' | 'shutdown';

interface VoiceEvent {
  mode: string;
  isActive: boolean;
}

class EventHandler {
  private events: EventMap = {};

  on<T>(event: string, callback: EventCallback<T>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  emit<T>(event: string, data: T) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  off<T>(event: string, callback: EventCallback<T>) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  clearAllListeners() {
    this.events = {};
  }
}

class VoiceRecognition extends EventHandler {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private mode: ListeningMode = 'wake_word';
  private orderWakeWord = "hey bar";
  private inquiryWakeWord = "hey bev";
  private retryCount = 0;
  private maxRetries = 3;
  private cleanup: (() => void) | null = null;

  constructor() {
    super();
    this.initializeRecognition();
  }

  private initializeRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.setupRecognition();
      logger.info('Speech recognition initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize speech recognition:', error);
      this.emit('error', {
        type: 'recognition' as ErrorType,
        message: 'Speech recognition initialization failed'
      } as VoiceError);
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.onresult = async (event: SpeechRecognitionEvent) => {
      try {
        const result = event.results[event.results.length - 1];
        if (!result?.[0]?.transcript) {
          throw new Error('Invalid speech recognition result');
        }

        const text = result[0].transcript.toLowerCase().trim();
        logger.info('Recognized text:', text);

        // Handle shutdown command in any mode
        if (text.includes('shut down')) {
          await this.handleShutdown();
          return;
        }

        switch (this.mode) {
          case 'wake_word':
            await this.handleWakeWordMode(text);
            break;
          case 'command':
            await this.handleCommandMode(text);
            break;
          case 'shutdown':
            // Do nothing in shutdown mode
            break;
        }
      } catch (error) {
        logger.error('Error processing speech result:', error);
        this.emit('error', {
          type: 'processing' as ErrorType,
          message: 'Failed to process speech input'
        } as VoiceError);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error('Speech recognition error:', event.error);

      if (event.error === 'network') {
        logger.error('Network error detected, stopping recognition');
        this.stop();
        return;
      }

      if (this.isListening && this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying speech recognition (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.start(), 1000);
      } else if (this.retryCount >= this.maxRetries) {
        logger.error('Max retry attempts reached');
        this.emit('error', {
          type: 'recognition' as ErrorType,
          message: 'Speech recognition failed after multiple attempts'
        } as VoiceError);
        this.stop();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening && this.mode !== 'shutdown') {
        logger.info('Recognition ended, restarting...');
        this.recognition?.start();
      }
    };
  }

  private async handleWakeWordMode(text: string) {
    const hasOrderWake = text.includes(this.orderWakeWord);
    const hasInquiryWake = text.includes(this.inquiryWakeWord);

    if (hasOrderWake || hasInquiryWake) {
      this.mode = 'command';
      await soundEffects.playWakeWord();
      this.emit('modeChange', {
        mode: this.mode,
        isActive: true
      });

      // Extract command after wake word if any
      const commandText = text
        .replace(hasOrderWake ? this.orderWakeWord : this.inquiryWakeWord, '')
        .trim();

      if (commandText) {
        this.emit('speech', commandText);
      }
    }
  }

  private async handleCommandMode(text: string) {
    // Check for stop listening command
    if (text.includes('stop listening')) {
      await soundEffects.playListeningStop();
      this.mode = 'wake_word';
      this.emit('modeChange', { mode: this.mode, isActive: false });
      return;
    }

    // Process regular commands
    this.emit('speech', text);
  }

  private async handleShutdown() {
    await soundEffects.playListeningStop();
    this.mode = 'shutdown';
    this.emit('shutdown');
    await this.stop();
  }

  async start() {
    if (!this.recognition) {
      this.emit('error', {
        type: 'recognition' as ErrorType,
        message: 'Speech recognition not available'
      } as VoiceError);
      return;
    }

    if (!this.isListening) {
      try {
        this.isListening = true;
        this.retryCount = 0;
        this.mode = 'wake_word';
        this.recognition.start();
        await soundEffects.playListeningStart();
        this.emit('start', { mode: this.mode });
      } catch (error) {
        logger.error('Error starting speech recognition:', error);
        this.emit('error', {
          type: 'recognition' as ErrorType,
          message: 'Failed to start speech recognition'
        } as VoiceError);
        this.isListening = false;
      }
    }
  }

  async stop() {
    if (this.recognition && this.isListening) {
      try {
        this.isListening = false;
        this.retryCount = 0;
        this.recognition.stop();
        await soundEffects.playListeningStop();
        this.emit('stop');
        this.cleanup?.();
      } catch (error) {
        logger.error('Error stopping speech recognition:', error);
        this.emit('error', {
          type: 'recognition' as ErrorType,
          message: 'Failed to stop speech recognition'
        } as VoiceError);
      }
    }
  }

  getMode(): ListeningMode {
    return this.mode;
  }

  isSupported(): boolean {
    return !!this.recognition;
  }

  setCleanup(cleanup: () => void) {
    this.cleanup = cleanup;
  }
}

export const voiceRecognition = new VoiceRecognition();