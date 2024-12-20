import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
let openai: OpenAI | null = null;

// Initialize OpenAI with retry logic and validation
const initializeOpenAI = (): boolean => {
  try {
    if (openai) {
      console.info('OpenAI client already initialized');
      return true;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables. Ensure OPENAI_API_KEY is properly set and exposed to the frontend.');
      return false;
    }

    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
    console.info('OpenAI client initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error instanceof Error ? error.message : 'Unknown error');
    return false;
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

  private isInitialized: boolean;

  private constructor() {
    this.cache = new Map();
    this.cacheExpiryMs = 30 * 60 * 1000; // 30 minutes
    this.isInitialized = initializeOpenAI();
    
    // Retry initialization after a delay if it fails
    if (!this.isInitialized) {
      setTimeout(() => {
        this.isInitialized = initializeOpenAI();
      }, 2000);
    }
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      this.isInitialized = initializeOpenAI();
      if (!this.isInitialized) {
        throw new Error('OpenAI client not initialized. Please check your API key.');
      }
    }
  }

  private async *streamSynthesizeSpeech(text: string): AsyncGenerator<{ chunk: ArrayBuffer; progress: number }> {
    try {
      console.info('Starting speech synthesis with streaming:', { textLength: text.length });
      this.ensureInitialized();
      if (!openai) {
        console.error('OpenAI client initialization failed');
        throw new Error('OpenAI client not initialized');
      }

      console.info('OpenAI client status: initialized and ready');

    try {
      const chunks: ArrayBuffer[] = [];
      // Using regular speech synthesis for now since streaming is not yet supported
      const response = await openai.audio.speech.create({
        model: "nova",
        voice: "nova",
        input: text,
      });
      
      // Convert the response to ArrayBuffer and split into smaller chunks
      const fullBuffer = await response.arrayBuffer();
      const totalSize = fullBuffer.byteLength;
      const chunkSize = 32 * 1024; // 32KB chunks
      
      for (let offset = 0; offset < totalSize; offset += chunkSize) {
        const chunk = fullBuffer.slice(offset, Math.min(offset + chunkSize, totalSize));
        yield { chunk, progress: Math.min(100, (offset + chunkSize) / totalSize * 100) };
        chunks.push(chunk);
      }

      // Cache the complete audio for future use
      const completeAudio = new Blob(chunks).arrayBuffer();
      this.cache.set(text, {
        audioBuffer: await completeAudio,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error synthesizing speech:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to synthesize speech');
    }
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

  public async speak(text: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      if (!openai) {
        initializeOpenAI();
      }
      
      this.cleanCache();

      // Check cache first
      const cached = this.cache.get(text);
      if (cached) {
        // Play cached audio
        const audioContext = new AudioContext();
        const source = audioContext.createBufferSource();
        const audioArrayBuffer = await audioContext.decodeAudioData(cached.audioBuffer);
        source.buffer = audioArrayBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        return new Promise((resolve) => {
          source.onended = () => {
            audioContext.close();
            resolve();
          };
        });
      }

      // For longer responses (> 100 chars), use streaming
      if (text.length > 100) {
        const audioContext = new AudioContext();
        const chunks: ArrayBuffer[] = [];
        let totalChunks = 0;
        
        for await (const { chunk, progress } of this.streamSynthesizeSpeech(text)) {
          chunks.push(chunk);
          
          // Report progress
          if (onProgress) {
            onProgress(progress);
          }

          // Play each chunk as it arrives
          const source = audioContext.createBufferSource();
          const audioArrayBuffer = await audioContext.decodeAudioData(chunk);
          source.buffer = audioArrayBuffer;
          source.connect(audioContext.destination);
          source.start(0);
          
          await new Promise((resolve) => {
            source.onended = resolve;
          });
        }

        audioContext.close();
        return;
      }

      // For shorter responses, use regular synthesis
      const audioBuffer = await this.synthesizeSpeech(text);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in speak:', errorMessage);
      
      // Check if we're offline
      if (!navigator.onLine || (error instanceof Error && error.message.includes('Failed to fetch'))) {
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
