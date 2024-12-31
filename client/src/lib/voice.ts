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

interface VoiceErrorEvent extends VoiceError {
  name: string;
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
  private wakeWords = {
    order: ['hey bar', 'hey bars', 'hey barb', 'hey boss', 'hay bar'],
    inquiry: ['hey bev', 'hey beth', 'hey belle', 'hey beb', 'hey v']
  };
  private retryCount = 0;
  private maxRetries = 5;
  private cleanup: (() => void) | null = null;
  private confidenceThreshold = 0.7;
  private lastWakeWordAttempt = 0;
  private wakeWordCooldown = 1000; // 1 second cooldown between attempts

  constructor() {
    super();
    this.initializeRecognition();
  }

  private initializeRecognition() {
    try {
      if (typeof window === 'undefined') return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      this.recognition = new SpeechRecognition();
      this.setupRecognitionConfig();
      this.setupRecognition();
      logger.info('Speech recognition initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize speech recognition:', error);
      this.emitError('InitializationError', 'Speech recognition initialization failed');
    }
  }

  private emitError(name: string, message: string, type: ErrorType = 'recognition') {
    const error: VoiceErrorEvent = {
      type,
      message,
      name
    };
    this.emit('error', error);
  }

  private setupRecognitionConfig() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'en-US';
  }

  private matchesWakeWord(text: string, wakeWordList: string[]): boolean {
    const normalizedText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    return wakeWordList.some(wakeWord => {
      const distance = this.levenshteinDistance(normalizedText, wakeWord);
      return distance <= 2;
    });
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.onresult = async (event: SpeechRecognitionEvent) => {
      try {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result?.[0]?.transcript) continue;

          const text = result[0].transcript.toLowerCase().trim();
          const confidence = result[0].confidence;

          logger.info('Recognized text:', text, 'Confidence:', confidence);

          if (text.includes('shut down') && confidence > this.confidenceThreshold) {
            await this.handleShutdown();
            return;
          }

          switch (this.mode) {
            case 'wake_word':
              await this.handleWakeWordMode(text, confidence);
              break;
            case 'command':
              await this.handleCommandMode(text, confidence);
              break;
          }
        }
      } catch (error) {
        logger.error('Error processing speech result:', error);
        this.emitError('ProcessingError', 'Failed to process speech input', 'processing');
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error('Speech recognition error:', event.error);

      if (event.error === 'network') {
        this.stop();
        return;
      }

      if (this.isListening && this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying speech recognition (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.start(), Math.min(1000 * this.retryCount, 5000));
      } else if (this.retryCount >= this.maxRetries) {
        logger.error('Max retry attempts reached');
        this.emitError('MaxRetriesError', 'Speech recognition failed after multiple attempts');
        this.stop();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening && this.mode !== 'shutdown') {
        logger.info('Recognition ended, restarting...');
        setTimeout(() => {
          if (this.recognition && this.isListening) {
            this.recognition.start();
          }
        }, 100);
      }
    };
  }

  private async handleWakeWordMode(text: string, confidence: number) {
    const now = Date.now();
    if (now - this.lastWakeWordAttempt < this.wakeWordCooldown) {
      return;
    }
    this.lastWakeWordAttempt = now;

    if (confidence < this.confidenceThreshold) {
      logger.info('Wake word detected but confidence too low:', confidence);
      return;
    }

    const isOrderWake = this.matchesWakeWord(text, this.wakeWords.order);
    const isInquiryWake = this.matchesWakeWord(text, this.wakeWords.inquiry);

    if (isOrderWake || isInquiryWake) {
      this.mode = 'command';
      await soundEffects.playWakeWord();
      this.emit('modeChange', { mode: this.mode, isActive: true });

      const wakeWord = isOrderWake ? this.wakeWords.order[0] : this.wakeWords.inquiry[0];
      const commandText = text.substring(text.indexOf(wakeWord) + wakeWord.length).trim();

      if (commandText) {
        this.emit('speech', commandText);
      }
    }
  }

  private async handleCommandMode(text: string, confidence: number) {
    if (confidence < this.confidenceThreshold) {
      logger.info('Command detected but confidence too low:', confidence);
      return;
    }

    if (text.includes('stop listening')) {
      await soundEffects.playListeningStop();
      this.mode = 'wake_word';
      this.emit('modeChange', { mode: this.mode, isActive: false });
      return;
    }

    this.emit('speech', text);
  }

  private async handleShutdown() {
    await soundEffects.playListeningStop();
    this.mode = 'shutdown';
    this.emit('shutdown', { mode: this.mode, isActive: false });
    await this.stop();
  }

  async start() {
    if (!this.recognition) {
      this.emitError('UnavailableError', 'Speech recognition not available');
      return;
    }

    if (!this.isListening) {
      try {
        this.isListening = true;
        this.retryCount = 0;
        this.mode = 'wake_word';
        this.recognition.start();
        await soundEffects.playListeningStart();
        this.emit('start', { mode: this.mode, isActive: true });
      } catch (error) {
        logger.error('Error starting speech recognition:', error);
        this.emitError('StartError', 'Failed to start speech recognition');
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
        this.emit('stop', { mode: 'shutdown', isActive: false });
        this.cleanup?.();
      } catch (error) {
        logger.error('Error stopping speech recognition:', error);
        this.emitError('StopError', 'Failed to stop speech recognition');
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