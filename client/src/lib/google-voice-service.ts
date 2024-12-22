import { SpeechClient } from '@google-cloud/speech';

class GoogleVoiceService {
  private speechClient: SpeechClient;
  private isListening: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    this.speechClient = new SpeechClient();
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Audio permissions granted');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw new Error('Microphone access is required');
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        await this.processAudio(audioBlob);
      };

      this.mediaRecorder.start();
      this.isListening = true;
      console.log('Started listening for voice commands');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    this.isListening = false;
    console.log('Stopped listening for voice commands');
  }

  private async processAudio(audioBlob: Blob): Promise<string> {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const audioBase64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          resolve(base64Audio.split(',')[1]);
        };
      });
      reader.readAsDataURL(audioBlob);
      const audioBytes = await audioBase64Promise;

      // Configure the request
      const audio = {
        content: audioBytes,
      };
      const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        model: 'command_and_search',
        useEnhanced: true,
      };
      const request = {
        audio: audio,
        config: config,
      };

      // Perform the transcription
      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        ?.map(result => result.alternatives?.[0]?.transcript)
        .join('\n');

      console.log('Transcription completed:', transcription);
      return transcription || '';
    } catch (error) {
      console.error('Error processing audio:', error);
      throw error;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// Export a singleton instance
export const googleVoiceService = new GoogleVoiceService();
