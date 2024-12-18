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

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      try {
        const result = event.results[event.results.length - 1];
        if (!result?.[0]?.transcript) {
          throw new Error('Invalid speech recognition result');
        }

        const text = result[0].transcript.toLowerCase();
        console.log('Recognized text:', text);

        // Check for wake words
        const hasOrderWake = text.includes(this.orderWakeWord);
        const hasInquiryWake = text.includes(this.inquiryWakeWord);
        
        console.log('Wake word detection:', {
          text,
          hasOrderWake,
          hasInquiryWake,
          orderWakeWord: this.orderWakeWord,
          inquiryWakeWord: this.inquiryWakeWord
        });

        if (hasOrderWake) {
          console.log('Order wake word detected, emitting order mode');
          this.emit('wakeWord', { mode: 'order' });
          this.retryCount = 0;
        } else if (hasInquiryWake) {
          console.log('Inquiry wake word detected, emitting inquiry mode');
          this.emit('wakeWord', { mode: 'inquiry' });
          this.retryCount = 0;
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
      
      // Map Web Speech API error types to our error types
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