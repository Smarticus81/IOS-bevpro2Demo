import OpenAI from "openai";

let openai: OpenAI | null = null;

// Initialize OpenAI client with proper error handling
try {
  if (import.meta.env.VITE_OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  } else {
    console.warn('OpenAI API key not configured. Voice synthesis will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export type ValidVoice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';

export async function synthesizeSpeech(text: string, voice: ValidVoice = 'nova', retries = 3): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Voice synthesis is unavailable.');
  }

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Attempting speech synthesis (attempt ${attempt + 1}/${retries})`);
      
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: text,
        speed: voice === 'nova' ? 1.1 : 1.0, // Slightly faster for Nova
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Speech synthesis successful');
      return audioUrl;
    } catch (error) {
      console.error(`Speech synthesis attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      // Only wait between retries, not after the last attempt
      if (attempt < retries - 1) {
        const delay = 1000 * (attempt + 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (lastError instanceof Error) {
    console.error('Speech synthesis failed after all retries:', lastError.message);
    throw lastError;
  } else {
    console.error('Speech synthesis failed after all retries with unknown error:', lastError);
    throw new Error('Speech synthesis failed with unknown error');
  }
}

// Cache for storing audio URLs
const audioCache = new Map<string, string>();

// Maximum number of cached items to keep
const MAX_CACHE_SIZE = 50;

export async function playCachedSpeech(text: string, voice: ValidVoice = 'nova'): Promise<void> {
  try {
    // Verify we have required configuration
    if (!openai) {
      throw new Error('OpenAI client not initialized. Voice synthesis is unavailable.');
    }

    const cacheKey = `${text}-${voice}`;
    let audioUrl = audioCache.get(cacheKey);
    
    if (!audioUrl) {
      // Clean up old cache entries if we're at the limit
      if (audioCache.size >= MAX_CACHE_SIZE) {
        const iterator = audioCache.keys();
        const first = iterator.next();
        if (!first.done) {
          const oldestKey = first.value;
          const oldUrl = audioCache.get(oldestKey);
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
            audioCache.delete(oldestKey);
          }
        }
      }

      console.log('Synthesizing speech for:', text);
      try {
        audioUrl = await synthesizeSpeech(text, voice);
        if (!audioUrl) {
          throw new Error('Failed to synthesize speech - no audio URL returned');
        }
        audioCache.set(cacheKey, audioUrl);
      } catch (synthError) {
        console.error('Speech synthesis failed:', synthError);
        throw synthError;
      }
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        console.log('Audio playback completed successfully');
        resolve();
      };

      audio.onerror = (event) => {
        cleanup();
        const errorMessage = event instanceof ErrorEvent ? event.message : 'Unknown audio playback error';
        console.error('Audio playback error:', errorMessage);
        audioCache.delete(cacheKey);
        reject(new Error(`Failed to play audio: ${errorMessage}`));
      };

      console.log('Starting audio playback...');
      audio.play().catch(error => {
        cleanup();
        console.error('Audio playback failed:', error);
        audioCache.delete(cacheKey);
        reject(error instanceof Error ? error : new Error('Failed to start audio playback'));
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Voice synthesis system error:', errorMessage);
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

export function clearAudioCache() {
  audioCache.forEach(url => URL.revokeObjectURL(url));
  audioCache.clear();
}

// Automatically clear cache when the window is about to unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearAudioCache);
}
