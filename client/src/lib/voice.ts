import type { ErrorType, VoiceError } from "@/types/speech";
import { soundEffects } from "./sound-effects";

type EventCallback<T = any> = (data?: T) => void;
type EventMap = { [key: string]: EventCallback[] };
type ListeningMode = 'wake_word' | 'command' | 'shutdown';

class EventHandler {
  private events: EventMap = {};

  on<T>(event: string, callback: EventCallback<T>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  emit<T>(event: string, data?: T) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  off<T>(event: string, callback: EventCallback<T>) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
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

  constructor() {
    super();
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
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.emit('error', 'Speech recognition initialization failed');
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

        const text = result[0].transcript.toLowerCase();
        console.log('Recognized text:', text);

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
        console.error('Error processing speech result:', error);
        this.emit('error', 'Failed to process speech input');
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);

      const errorTypeMap: { [key: string]: ErrorType } = {
        'network': 'network',
        'no-speech': 'recognition',
        'audio-capture': 'recognition',
        'not-allowed': 'recognition',
        'service-not-allowed': 'network',
        'bad-grammar': 'processing',
        'aborted': 'processing'
      };

      const errorType = errorTypeMap[event.error] || 'processing';
      const errorMessage = event.message || `Recognition error: ${event.error}`;

      this.emit('error', { type: errorType, message: errorMessage });
      soundEffects.playError();

      if (errorType === 'network') {
        console.error('Network error detected, stopping recognition');
        this.stop();
        return;
      }

      if (this.isListening && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying speech recognition (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.start(), 1000);
      } else if (this.retryCount >= this.maxRetries) {
        console.error('Max retry attempts reached');
        this.emit('error', { 
          type: 'recognition', 
          message: 'Speech recognition failed after multiple attempts. Please try again.'
        });
        this.stop();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening && this.mode !== 'shutdown') {
        console.log('Recognition ended, restarting...');
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
        mode: hasOrderWake ? 'order' : 'inquiry',
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
      this.emit('modeChange', { mode: 'wake_word', isActive: false });
      return;
    }

    // Process regular commands
    this.emit('speech', text);
  }

  private async handleShutdown() {
    await soundEffects.playListeningStop();
    this.mode = 'shutdown';
    this.emit('shutdown');
    this.stop();
  }

  async start() {
    if (!this.recognition) {
      this.emit('error', 'Speech recognition not available');
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
        console.error('Error starting speech recognition:', error);
        this.emit('error', 'Failed to start speech recognition');
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
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        this.emit('error', 'Failed to stop speech recognition');
      }
    }
  }

  getMode(): ListeningMode {
    return this.mode;
  }

  isSupported(): boolean {
    return !!this.recognition;
  }
}

export const voiceRecognition = new VoiceRecognition();