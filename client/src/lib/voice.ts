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
    order: [
      'hey bar', 'hey bars', 'hey barb', 'hey boss', 'hay bar', 'a bar', 'hey far', 'hey ba',
      'hey bartender', 'hey partner', 'hey there', 'hi bar', 'high bar', 'a bar', 'hey baar'
    ],
    inquiry: [
      'hey bev', 'hey beth', 'hey belle', 'hey beb', 'hey v', 'hey b', 'hey bed',
      'hey beverage', 'hey bevpro', 'hey babe', 'hey bev pro', 'hey beverage pro'
    ]
  };
  private retryCount = 0;
  private maxRetries = 5;
  private cleanup: (() => void) | null = null;
  private confidenceThreshold = 0.35; // Lowered threshold for better detection
  private lastWakeWordAttempt = 0;
  private wakeWordCooldown = 800; // Increased cooldown to prevent false triggers
  private lastProcessedCommand = '';
  private lastProcessedTimestamp = 0;
  private readonly COMMAND_DEBOUNCE_TIME = 2000;
  private partialResults: string[] = [];
  private lastPartialResultTime = 0;
  private readonly PARTIAL_RESULT_TIMEOUT = 1500; // Increased timeout for better partial result handling
  private isWakeWordJustDetected = false;
  private wakeWordClearTimeout: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

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
      this.emitError('InitializationError', 'Speech recognition initialization failed');
    }
  }

  private setupRecognitionConfig() {
    if (!this.recognition) return;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5; // Increased alternatives for better matching
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

  private emitError(name: string | Error, message: string) {
    const error: VoiceErrorEvent = {
      type: 'recognition',
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
      this.consecutiveFailures = 0;
      logger.info('Speech recognition started');
    };

    this.recognition.onend = () => {
      if (this.isListening && !this.cleanup) {
        try {
          // Add delay before restarting to prevent rapid restarts
          setTimeout(() => {
            if (this.isListening && this.recognition) {
              this.recognition.start();
              logger.info('Speech recognition restarted');
            }
          }, 100);
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

  private async handleRecognitionResult(event: SpeechRecognitionEvent) {
    try {
      const results = Array.from(event.results);
      if (!results.length) return;

      const result = results[results.length - 1];
      if (!result?.[0]?.transcript) return;

      // Check all alternatives for better wake word matching
      const alternatives = Array.from(result).map(alt => ({
        text: alt.transcript.toLowerCase().trim(),
        confidence: alt.confidence
      }));

      // Log all alternatives for debugging
      logger.info('Recognition alternatives:', alternatives);

      const bestMatch = alternatives.reduce((best, current) => {
        return current.confidence > best.confidence ? current : best;
      });

      const { text, confidence } = bestMatch;

      if (!text) return;

      // Reset consecutive failures on successful recognition
      this.consecutiveFailures = 0;

      if (!result.isFinal) {
        this.lastPartialResultTime = Date.now();
        this.partialResults.push(text);
        return;
      }

      this.clearPartialResults();

      // Check for shutdown command first
      if (text.includes('shut down') || text.includes('shutdown')) {
        await this.handleShutdown();
        return;
      }

      // Handle based on current mode
      switch (this.mode) {
        case 'wake_word':
          await this.handleWakeWordMode(text, confidence);
          break;
        case 'command':
          if (!this.isWakeWordJustDetected) {
            await this.handleCommandMode(text, confidence);
          }
          break;
      }

      // Update last processed command tracking
      if (result.isFinal && !this.isWakeWordJustDetected) {
        this.lastProcessedCommand = text;
        this.lastProcessedTimestamp = Date.now();
      }
      this.partialResults = [];

    } catch (error) {
      logger.error('Error processing speech result:', error);
      this.emitError('ProcessingError', 'Failed to process speech input');
      this.handleRecognitionFailure();
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent) {
    const nonFatalErrors = ['no-speech', 'audio-capture', 'network', 'aborted'];
    if (!nonFatalErrors.includes(event.error)) {
      this.emitError('RecognitionError', `Speech recognition error: ${event.error}`);
      this.handleRecognitionFailure();
    }
  }

  private handleRecognitionFailure() {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      logger.warn('Too many consecutive failures, resetting recognition');
      this.reset();
    }
  }

  private async handleWakeWordMode(text: string, confidence: number) {
    const now = Date.now();
    if (now - this.lastWakeWordAttempt < this.wakeWordCooldown) {
      return;
    }
    this.lastWakeWordAttempt = now;

    // Function to check if text contains any wake word with fuzzy matching
    const containsWakeWord = (text: string, wakeWords: string[]): boolean => {
      return wakeWords.some(word => {
        const distance = this.levenshteinDistance(text, word);
        // Allow for small variations in pronunciation
        return distance <= 2 || text.includes(word);
      });
    };

    const isOrderWake = containsWakeWord(text, this.wakeWords.order);
    const isInquiryWake = containsWakeWord(text, this.wakeWords.inquiry);

    if ((isOrderWake || isInquiryWake) && confidence >= this.confidenceThreshold) {
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
      }, 1000);

      logger.info('Wake word detected:', { text, confidence, type: isOrderWake ? 'order' : 'inquiry' });
    }
  }

  private async handleCommandMode(text: string, confidence: number) {
    if (this.isWakeWordJustDetected) {
      return;
    }

    if (!this.shouldProcessCommand(text)) {
      return;
    }

    const emotionalMarkers = {
      frustrated: ['wrong', 'no ', 'not ', 'incorrect', 'stop', 'cancel'],
      enthusiastic: ['great', 'perfect', 'awesome', 'yes', 'good'],
      apologetic: ['sorry', 'oops', 'mistake', 'my bad']
    };

    let detectedEmotion: string | undefined;
    for (const [emotion, markers] of Object.entries(emotionalMarkers)) {
      if (markers.some(marker => text.toLowerCase().includes(marker))) {
        detectedEmotion = emotion;
        break;
      }
    }

    if (text.includes('stop listening')) {
      await soundEffects.playListeningStop();
      this.mode = 'wake_word';
      this.emit('modeChange', { mode: this.mode, isActive: false });
      return;
    }

    logger.info('Processing voice command:', {
      text,
      emotion: detectedEmotion,
      confidence
    });

    this.emit('speech', text);
  }

  private async handleShutdown() {
    await soundEffects.playListeningStop();
    this.mode = 'shutdown';
    this.emit('shutdown', { mode: this.mode, isActive: false });
    await this.stop();
  }

  // Levenshtein distance calculation for fuzzy matching
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            )
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private reset() {
    if (this.recognition) {
      try {
        this.recognition.abort();
        this.initializeRecognition();
        this.consecutiveFailures = 0;
        logger.info('Speech recognition reset successfully');
      } catch (error) {
        logger.error('Error resetting speech recognition:', error);
      }
    }
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
        this.partialResults = [];
        this.lastProcessedCommand = '';
        this.lastProcessedTimestamp = 0;
        this.consecutiveFailures = 0;
        this.recognition.start();
        await soundEffects.playListeningStart();
        this.emit('start', { mode: this.mode, isActive: true });
        logger.info('Voice recognition started successfully');
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
        this.cleanup?.();
        this.cleanup = null;
        this.recognition.stop();
        await soundEffects.playListeningStop();
        this.emit('stop', { mode: 'shutdown', isActive: false });
        logger.info('Voice recognition stopped successfully');
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