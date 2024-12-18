import { transcribeAudioGoogle } from './google-speech';

export type VoiceProvider = 'browser' | 'google' | 'openai';

export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private wakeWord = "hey bar";
  private isListening = false;
  private onWakeWordCallback: (() => void) | null = null;
  private onSpeechCallback: ((text: string) => void) | null = null;
  private currentProvider: VoiceProvider = 'browser';

  constructor(provider: VoiceProvider = 'browser') {
    this.setProvider(provider);
  }

  private async setupMediaRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.audioChunks = [];
        
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const text = await transcribeAudioGoogle(arrayBuffer);
          
          if (text.toLowerCase().includes(this.wakeWord)) {
            this.onWakeWordCallback?.();
          } else if (this.onSpeechCallback) {
            this.onSpeechCallback(text);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        }
      };
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }

  public async setProvider(provider: VoiceProvider) {
    this.stop();
    this.currentProvider = provider;

    if (provider === 'browser') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = this.handleSpeechResult.bind(this);
      this.recognition.onerror = this.handleError.bind(this);
      this.recognition.onend = () => {
        if (this.isListening) {
          this.recognition?.start();
        }
      };
    } else if (provider === 'google') {
      await this.setupMediaRecorder();
    }
  }

  public start() {
    this.isListening = true;
    if (this.currentProvider === 'browser' && this.recognition) {
      this.recognition.start();
    } else if (this.currentProvider === 'google' && this.mediaRecorder) {
      this.audioChunks = [];
      this.mediaRecorder.start();
      // Record for 5 seconds at a time
      setInterval(() => {
        if (this.isListening && this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
          this.mediaRecorder.start();
        }
      }, 5000);
    }
  }

  public stop() {
    this.isListening = false;
    if (this.currentProvider === 'browser' && this.recognition) {
      this.recognition.stop();
    } else if (this.currentProvider === 'google' && this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
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
    if (this.isListening && this.recognition) {
      setTimeout(() => {
        this.recognition?.start();
      }, 1000);
    }
  }

  public getCurrentProvider(): VoiceProvider {
    return this.currentProvider;
  }
}

export const voiceRecognition = new VoiceRecognition();
