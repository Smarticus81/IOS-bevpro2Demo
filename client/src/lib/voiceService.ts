type EmotionType = 'happy' | 'neutral' | 'excited' | 'concerned' | 'apologetic';

interface EmotionConfig {
  pitch: number;
  rate: number;
  volume: number;
}

interface CachedVoiceResponse {
  audio: HTMLAudioElement;
  timestamp: number;
  emotion?: EmotionType;
}

class VoiceService {
  private static instance: VoiceService;
  private cache: Map<string, CachedVoiceResponse>;
  private cacheExpiryMs: number;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.cache = new Map();
    this.cacheExpiryMs = 30 * 60 * 1000; // 30 minutes
    this.initializeVoice();
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private async initializeVoice(): Promise<void> {
    if (this.isInitialized) return;

    // Wait for voices to be loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true });
      });
    }

    // Select a high-quality voice
    const voices = window.speechSynthesis.getVoices();
    this.selectedVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('samantha') || // macOS
      voice.name.toLowerCase().includes('microsoft zira') || // Windows
      voice.name.toLowerCase().includes('google us english female') // Chrome
    ) || voices[0];

    this.isInitialized = true;
    console.info('Voice service initialized with voice:', this.selectedVoice?.name);
  }

  private getEmotionConfig(emotion: EmotionType): EmotionConfig {
    const configs: Record<EmotionType, EmotionConfig> = {
      happy: { pitch: 1.1, rate: 1.1, volume: 1.0 },
      neutral: { pitch: 1.0, rate: 1.0, volume: 1.0 },
      excited: { pitch: 1.2, rate: 1.2, volume: 1.0 },
      concerned: { pitch: 0.9, rate: 0.9, volume: 0.9 },
      apologetic: { pitch: 0.8, rate: 0.9, volume: 0.8 }
    };
    return configs[emotion];
  }

  private detectEmotion(text: string): EmotionType {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('sorry') || lowerText.includes('apologize') || lowerText.includes('error')) {
      return 'apologetic';
    }
    if (lowerText.includes('successfully') || lowerText.includes('great') || lowerText.includes('perfect')) {
      return 'happy';
    }
    if (lowerText.includes('warning') || lowerText.includes('careful') || lowerText.includes('attention')) {
      return 'concerned';
    }
    if (lowerText.includes('added') || lowerText.includes('welcome') || lowerText.includes('awesome')) {
      return 'excited';
    }
    return 'neutral';
  }

  private cleanCache(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, value]) => {
      if (now - value.timestamp > this.cacheExpiryMs) {
        this.cache.delete(key);
      }
    });
  }

  public async speak(text: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initializeVoice();
      }

      this.cleanCache();

      // Configure speech with emotion
      const emotion = this.detectEmotion(text);
      const config = this.getEmotionConfig(emotion);

      console.info('Speaking with emotion:', { emotion, config });

      // Create and configure utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.selectedVoice;
      utterance.pitch = config.pitch;
      utterance.rate = config.rate;
      utterance.volume = config.volume;

      // Set up progress tracking
      let wordCount = 0;
      const totalWords = text.split(/\s+/).length;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          wordCount++;
          if (onProgress) {
            onProgress((wordCount / totalWords) * 100);
          }
        }
      };

      // Handle errors
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        throw new Error('Speech synthesis failed');
      };

      // Speak
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      window.speechSynthesis.speak(utterance);

      // Return a promise that resolves when speech is complete
      return new Promise((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(new Error(`Speech synthesis failed: ${event.error}`));
      });
    } catch (error) {
      console.error('Error in speak:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}

export const voiceService = VoiceService.getInstance();