import type { ErrorType, VoiceError } from "@/types/speech";
import { soundEffects } from "./sound-effects";
import { voiceAgent } from './voice-agent';

type EventCallback<T = any> = (data?: T) => void;
type EventMap = { [key: string]: EventCallback[] };

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
  private orderWakeWord = "hey bar";
  private inquiryWakeWord = "hey bev";
  private retryWakeWord = "hey pro";
  private retryCount = 0;
  private maxRetries = 3;
  private processingCommand = false;

  // Order completion phrases
  private completionPhrases = [
    "complete order",
    "process order",
    "finish order",
    "place order",
    "that's it",
    "thats it",
    "complete",
    "process",
    "finish",
    "done",
    "okay thats it",
    "okay that's it"
  ];

  // Order cancellation phrases
  private cancellationPhrases = [
    "cancel order",
    "void order",
    "delete order",
    "remove order",
    "clear cart",
    "cancel",
    "void",
    "delete",
    "clear"
  ];

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
      voiceAgent.initialize(); // Initialize the enhanced voice agent
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.emit('error', 'Speech recognition initialization failed');
    }
  }

  private async processCommand(text: string) {
    try {
      const { response, confidence } = await voiceAgent.processCommand(text);

      // Check for completion phrases first
      const isCompletionCommand = this.completionPhrases.some(phrase => 
        text.toLowerCase().includes(phrase.toLowerCase())
      );

      // Check for cancellation phrases
      const isCancellationCommand = this.cancellationPhrases.some(phrase =>
        text.toLowerCase().includes(phrase.toLowerCase())
      );

      if (isCompletionCommand) {
        console.log('Completion command detected');
        await soundEffects.playSuccess();
        this.emit('completion', { type: 'complete_order' });
        return;
      }

      if (isCancellationCommand) {
        console.log('Cancellation command detected');
        await soundEffects.playError();
        this.emit('cancel', { type: 'cancel_order' });
        return;
      }

      // Process wake words and commands
      const hasOrderWake = text.toLowerCase().includes(this.orderWakeWord);
      const hasInquiryWake = text.toLowerCase().includes(this.inquiryWakeWord);
      const hasRetryWake = text.toLowerCase().includes(this.retryWakeWord);

      if (confidence > 0.7) { // Only process high-confidence commands
        if (hasOrderWake) {
          const commandText = text.toLowerCase().replace(this.orderWakeWord, '').trim();
          this.emit('modeChange', { mode: 'order', isActive: true });
          if (commandText) {
            this.emit('speech', commandText);
          }
        } else if (hasInquiryWake) {
          const commandText = text.toLowerCase().replace(this.inquiryWakeWord, '').trim();
          this.emit('modeChange', { mode: 'inquiry', isActive: true });
          if (commandText) {
            this.emit('speech', commandText);
          }
        } else if (hasRetryWake) {
          const commandText = text.toLowerCase().replace(this.retryWakeWord, '').trim();
          this.emit('modeChange', { mode: 'retry', isActive: true });
          this.retryCount = 0;
          if (commandText) {
            this.emit('speech', commandText);
          }
        } else {
          this.emit('speech', text);
        }
      }
    } catch (error) {
      console.error('Error processing command:', error);
      this.emit('error', 'Failed to process voice command');
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

        // Play wake word sound if detected
        if (text.includes(this.orderWakeWord) || 
            text.includes(this.inquiryWakeWord) || 
            text.includes(this.retryWakeWord)) {
          await soundEffects.playWakeWord();
        }

        await this.processCommand(text);
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
      if (this.isListening && this.retryCount < this.maxRetries) {
        console.log('Recognition ended, restarting...');
        this.recognition?.start();
      }
    };
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
        this.recognition.start();
        await soundEffects.playListeningStart();
        this.emit('start');
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

  isSupported(): boolean {
    return !!this.recognition;
  }
}

export const voiceRecognition = new VoiceRecognition();