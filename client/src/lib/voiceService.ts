import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
let openai: OpenAI | null = null;

// Initialize OpenAI with retry logic
const initializeOpenAI = () => {
  try {
    if (!openai && import.meta.env.VITE_OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });
      console.info('OpenAI client initialized successfully');
    } else if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
    }
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
  }
};

interface CachedVoiceResponse {
  audioBuffer: ArrayBuffer;
  timestamp: number;
}

class VoiceService {
  private static instance: VoiceService;
  private cache: Map<string, CachedVoiceResponse>;
  private cacheExpiryMs: number;

  private constructor() {
    this.cache = new Map();
    this.cacheExpiryMs = 30 * 60 * 1000; // 30 minutes
    initializeOpenAI();
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private async synthesizeSpeech(text: string): Promise<ArrayBuffer> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await openai.audio.speech.create({
        model: "nova",
        voice: "nova",
        input: text,
      });

      // Convert the response to ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, value]) => {
      if (now - value.timestamp > this.cacheExpiryMs) {
        this.cache.delete(key);
      }
    });
  }

  public async speak(text: string): Promise<void> {
    try {
      if (!openai) {
        initializeOpenAI();
      }
      
      this.cleanCache();

      // Check cache first
      const cached = this.cache.get(text);
      let audioBuffer: ArrayBuffer;

      if (cached) {
        audioBuffer = cached.audioBuffer;
      } else {
        // Synthesize new speech
        audioBuffer = await this.synthesizeSpeech(text);
        // Cache the result
        this.cache.set(text, {
          audioBuffer,
          timestamp: Date.now()
        });
      }

      // Play the audio
      const audioContext = new AudioContext();
      const source = audioContext.createBufferSource();
      const audioArrayBuffer = await audioContext.decodeAudioData(audioBuffer);
      source.buffer = audioArrayBuffer;
      source.connect(audioContext.destination);
      source.start(0);

      return new Promise((resolve) => {
        source.onended = () => {
          audioContext.close();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error in speak:', error);
      
      // Check if we're offline
      if (!navigator.onLine || error.message.includes('Failed to fetch')) {
        console.info('Falling back to Web Speech API due to offline/network error');
        
        // Configure Web Speech API fallback
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to match Nova's voice characteristics
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('samantha') || // macOS
          voice.name.toLowerCase().includes('microsoft zira') || // Windows
          voice.name.toLowerCase().includes('google us english female') // Chrome
        );
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        // Handle potential Web Speech API errors
        return new Promise((resolve, reject) => {
          utterance.onend = () => resolve();
          utterance.onerror = (event) => {
            console.error('Web Speech API fallback error:', event);
            reject(new Error('Failed to use Web Speech API fallback'));
          };
          
          try {
            window.speechSynthesis.speak(utterance);
          } catch (fallbackError) {
            console.error('Critical error in Web Speech API:', fallbackError);
            reject(fallbackError);
          }
        });
      }
      
      // If we're online but OpenAI failed for other reasons, throw the original error
      throw error;
    }
  }
}

export const voiceService = VoiceService.getInstance();
