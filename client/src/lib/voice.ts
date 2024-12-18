import { EventEmitter } from 'events';

class VoiceRecognition extends EventEmitter {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private wakeWord = "hey bar";

  constructor() {
    super();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.setupRecognition();
    } else {
      console.error('Speech recognition not supported');
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (text.includes(this.wakeWord)) {
        this.emit('wakeWord');
      } else {
        this.emit('speech', text);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (this.isListening) {
        setTimeout(() => this.start(), 1000);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition?.start();
      }
    };
  }

  start() {
    if (this.recognition && !this.isListening) {
      this.isListening = true;
      this.recognition.start();
      this.emit('start');
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
      this.emit('stop');
    }
  }

  isSupported() {
    return !!this.recognition;
  }
}

export const voiceRecognition = new VoiceRecognition();