export class VoiceRecognition {
  private recognition: SpeechRecognition;
  private wakeWord = "hey bar";
  private isListening = false;
  private onWakeWordCallback: (() => void) | null = null;
  private onSpeechCallback: ((text: string) => void) | null = null;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = this.handleSpeechResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition.start();
      }
    };
  }

  public start() {
    this.isListening = true;
    this.recognition.start();
  }

  public stop() {
    this.isListening = false;
    this.recognition.stop();
  }

  public onWakeWord(callback: () => void) {
    this.onWakeWordCallback = callback;
  }

  public onSpeech(callback: (text: string) => void) {
    this.onSpeechCallback = callback;
  }

  private handleSpeechResult(event: SpeechRecognitionEvent) {
    const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
    
    if (text.includes(this.wakeWord)) {
      this.onWakeWordCallback?.();
    } else if (this.onSpeechCallback) {
      this.onSpeechCallback(text);
    }
  }

  private handleError(event: SpeechRecognitionErrorEvent) {
    console.error('Speech recognition error:', event.error);
    if (this.isListening) {
      setTimeout(() => {
        this.recognition.start();
      }, 1000);
    }
  }
}

export const voiceRecognition = new VoiceRecognition();
