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
  type: ErrorType;
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
    order: ['hey bar', 'hey bars', 'hey barb', 'hey boss', 'hay bar', 'a bar', 'hey far', 'hey ba'],
    inquiry: ['hey bev', 'hey beth', 'hey belle', 'hey beb', 'hey v', 'hey b', 'hey bed']
  };
  private retryCount = 0;
  private maxRetries = 5;
  private cleanup: (() => void) | null = null;
  private confidenceThreshold = 0.4;
  private lastWakeWordAttempt = 0;
  private wakeWordCooldown = 500;
  private lastProcessedCommand = '';
  private lastProcessedTimestamp = 0;
  private readonly COMMAND_DEBOUNCE_TIME = 2000;
  private partialResults: string[] = [];
  private lastPartialResultTime = 0;
  private readonly PARTIAL_RESULT_TIMEOUT = 1000;
  private isWakeWordJustDetected = false;
  private wakeWordClearTimeout: NodeJS.Timeout | null = null;

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
      this.setupEventHandlers();
      logger.info('Speech recognition initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize speech recognition:', error);
      this.emitError('InitializationError', 'Speech recognition initialization failed', 'initialization');
    }
  }

  private setupRecognitionConfig() {
    if (!this.recognition) return;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'en-US';
  }

  private clearPartialResults() {
    const now = Date.now();
    if (now - this.lastPartialResultTime > this.PARTIAL_RESULT_TIMEOUT) {
      this.partialResults = [];
    }
  }

  private shouldProcessCommand(text: string): boolean {
    const now = Date.now();
    if (text === this.lastProcessedCommand &&
        now - this.lastProcessedTimestamp < this.COMMAND_DEBOUNCE_TIME) {
      logger.info('Duplicate command detected, skipping:', text);
      return false;
    }
    return true;
  }

  private emitError(name: string | Error, message: string, type: ErrorType = 'recognition') {
    const error: VoiceErrorEvent = {
      type,
      message: typeof name === 'string' ? message : name.message,
      name: typeof name === 'string' ? name : name.name
    };
    this.emit('error', error);
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.partialResults = [];
      this.lastProcessedCommand = '';
      this.lastProcessedTimestamp = 0;
      this.isWakeWordJustDetected = false;
    };

    this.recognition.onend = () => {
      if (this.isListening && !this.cleanup) {
        try {
          this.recognition?.start();
        } catch (error) {
          logger.error('Failed to restart speech recognition:', error);
          this.isListening = false;
          this.cleanup = null;
        }
      }
    };

    this.recognition.onerror = this.handleRecognitionError.bind(this);
    this.recognition.onresult = this.handleRecognitionResult.bind(this);
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent) {
    try {
      const results = Array.from(event.results);
      if (!results.length) return;

      const result = results[results.length - 1];
      if (!result?.[0]?.transcript) return;

      const text = result[0].transcript.toLowerCase().trim();
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      // Log the recognized text for debugging
      logger.info('Recognized text:', text);

      if (!isFinal) {
        this.lastPartialResultTime = Date.now();
        this.partialResults.push(text);
        return;
      }

      this.clearPartialResults();

      // Only process final results that meet confidence threshold
      if (confidence < this.confidenceThreshold) {
        logger.info('Low confidence result ignored:', { text, confidence });
        return;
      }

      // Check for shutdown command first
      if (text.includes('shut down') || text.includes('shutdown')) {
        this.handleShutdown();
        return;
      }

      // Handle based on current mode
      switch (this.mode) {
        case 'wake_word':
          this.handleWakeWordMode(text, confidence);
          break;
        case 'command':
          // Only process commands if we're not in the wake word cooldown period
          if (!this.isWakeWordJustDetected) {
            this.handleCommandMode(text, confidence);
          }
          break;
      }

      // Update last processed command tracking
      if (isFinal && !this.isWakeWordJustDetected) {
        this.lastProcessedCommand = text;
        this.lastProcessedTimestamp = Date.now();
      }
      this.partialResults = [];

    } catch (error) {
      logger.error('Error processing speech result:', error);
      this.emitError('ProcessingError', 'Failed to process speech input', 'processing');
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent) {
    const nonFatalErrors = ['no-speech', 'audio-capture', 'network', 'aborted'];
    if (!nonFatalErrors.includes(event.error)) {
      this.emitError('RecognitionError', `Speech recognition error: ${event.error}`, 'recognition');
    }
  }

  private async handleWakeWordMode(text: string, confidence: number) {
    const now = Date.now();
    if (now - this.lastWakeWordAttempt < this.wakeWordCooldown) {
      return;
    }
    this.lastWakeWordAttempt = now;

    const isOrderWake = this.wakeWords.order.some(word => text.includes(word));
    const isInquiryWake = this.wakeWords.inquiry.some(word => text.includes(word));

    if (isOrderWake || isInquiryWake) {
      this.mode = 'command';
      await soundEffects.playWakeWord();
      this.emit('modeChange', { mode: this.mode, isActive: true });

      // Set flag to prevent immediate command processing
      this.isWakeWordJustDetected = true;

      // Clear the wake word detection flag after a short delay
      if (this.wakeWordClearTimeout) {
        clearTimeout(this.wakeWordClearTimeout);
      }
      this.wakeWordClearTimeout = setTimeout(() => {
        this.isWakeWordJustDetected = false;
      }, 1000); // 1 second delay
    }
  }

  private async handleCommandMode(text: string, confidence: number) {
    // Skip command processing if we just detected a wake word
    if (this.isWakeWordJustDetected) {
      return;
    }

    // Debounce processing of similar commands
    if (!this.shouldProcessCommand(text)) {
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
      this.emitError('UnavailableError', 'Speech recognition not available', 'initialization');
      return;
    }

    if (!this.isListening) {
      try {
        this.isListening = true;
        this.retryCount = 0;
        this.mode = 'wake_word';
        this.partialResults = [];
        this.lastProcessedCommand = '';
        this.lastProcessedTimestamp = 0;
        this.recognition.start();
        await soundEffects.playListeningStart();
        this.emit('start', { mode: this.mode, isActive: true });
      } catch (error) {
        logger.error('Error starting speech recognition:', error);
        this.emitError('StartError', 'Failed to start speech recognition', 'initialization');
        this.isListening = false;
      }
    }
  }

  async stop() {
    if (this.recognition && this.isListening) {
      try {
        this.isListening = false;
        this.retryCount = 0;
        this.cleanup?.();
        this.cleanup = null;
        this.recognition.stop();
        await soundEffects.playListeningStop();
        this.emit('stop', { mode: 'shutdown', isActive: false });
      } catch (error) {
        logger.error('Error stopping speech recognition:', error);
        this.emitError('StopError', 'Failed to stop speech recognition', 'recognition');
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