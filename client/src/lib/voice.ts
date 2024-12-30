import type { ErrorType, VoiceError } from "@/types/speech";

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

  // Add completion phrases
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
    "done"
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
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.emit('error', 'Speech recognition initialization failed');
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      try {
        const result = event.results[event.results.length - 1];
        if (!result?.[0]?.transcript) {
          throw new Error('Invalid speech recognition result');
        }

        const text = result[0].transcript.toLowerCase();
        console.log('Recognized text:', text);

        // Check for completion phrases first
        const isCompletionCommand = this.completionPhrases.some(phrase => 
          text.toLowerCase().includes(phrase.toLowerCase())
        );

        if (isCompletionCommand) {
          console.log('Completion command detected');
          this.emit('completion', { type: 'complete_order' });
          return;
        }

        // Enhanced wake word detection with retry capability
        const hasOrderWake = text.toLowerCase().includes(this.orderWakeWord);
        const hasInquiryWake = text.toLowerCase().includes(this.inquiryWakeWord);
        const hasRetryWake = text.toLowerCase().includes(this.retryWakeWord);

        console.log('Wake word detection:', {
          text,
          hasOrderWake,
          hasInquiryWake,
          hasRetryWake,
          isCompletionCommand,
          orderWakeWord: this.orderWakeWord,
          inquiryWakeWord: this.inquiryWakeWord,
          retryWakeWord: this.retryWakeWord
        });

        // Extract just the command part after wake word if present
        let commandText = text;
        let detectedMode: 'order' | 'inquiry' | 'retry' | null = null;

        if (hasOrderWake) {
          console.log('Order wake word detected');
          detectedMode = 'order';
          commandText = text.toLowerCase().replace(this.orderWakeWord, '').trim();
          this.emit('modeChange', { mode: 'order', isActive: true });
        } else if (hasInquiryWake) {
          console.log('Inquiry wake word detected');
          detectedMode = 'inquiry';
          commandText = text.toLowerCase().replace(this.inquiryWakeWord, '').trim();
          this.emit('modeChange', { mode: 'inquiry', isActive: true });
        } else if (hasRetryWake) {
          console.log('Retry wake word detected');
          detectedMode = 'retry';
          commandText = text.toLowerCase().replace(this.retryWakeWord, '').trim();
          this.emit('modeChange', { mode: 'retry', isActive: true });
          this.retryCount = 0;
        }

        if (detectedMode) {
          console.log('Wake word detected, emitting mode:', detectedMode);
          this.emit('wakeWord', { mode: detectedMode });
          this.retryCount = 0;

          if (commandText) {
            setTimeout(() => {
              console.log('Processing command after wake word:', commandText);
              this.emit('speech', commandText);
            }, 500);
          }
        } else {
          console.log('No wake word detected, emitting speech');
          this.emit('speech', text);
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

  start() {
    if (!this.recognition) {
      this.emit('error', 'Speech recognition not available');
      return;
    }

    if (!this.isListening) {
      try {
        this.isListening = true;
        this.retryCount = 0;
        this.recognition.start();
        this.emit('start');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        this.emit('error', 'Failed to start speech recognition');
        this.isListening = false;
      }
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.isListening = false;
        this.retryCount = 0;
        this.recognition.stop();
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