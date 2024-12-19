import OpenAI from "openai";

let openai: OpenAI | null = null;

// Initialize OpenAI client with proper error handling
try {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (apiKey) {
    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
    console.info('OpenAI client initialized successfully for voice synthesis');
  } else {
    console.warn('OPENAI_API_KEY not found in environment variables. Voice synthesis will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  if (error instanceof Error) {
    console.error('Error details:', error.message);
  }
}

// Verify OpenAI client initialization
console.debug('OpenAI client status:', openai ? 'initialized' : 'not initialized');

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export type ValidVoice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';

export async function synthesizeSpeech(text: string, voice: ValidVoice = 'nova', retries = 3): Promise<string> {
  // Early validation
  if (!text?.trim()) {
    throw new Error('No text provided for speech synthesis');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized. Voice synthesis is unavailable. Please check your API key configuration.');
  }

  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.info(`Attempting speech synthesis (attempt ${attempt + 1}/${retries})`, {
        textLength: text.length,
        voice,
        attempt: attempt + 1
      });
      
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice,
        input: text,
        speed: voice === 'nova' ? 1.1 : 1.0, // Slightly faster for Nova
      });

      if (!response) {
        throw new Error('No response received from OpenAI API');
      }

      const audioBlob = await response.blob();
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Invalid audio blob received from API');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      console.info('Speech synthesis successful', {
        blobSize: audioBlob.size,
        mimeType: audioBlob.type
      });
      
      return audioUrl;
    } catch (error) {
      console.error(`Speech synthesis attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      if (attempt < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.info(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Enhanced error handling with type checking
  if (lastError instanceof Error) {
    const errorMessage = `Speech synthesis failed after ${retries} attempts: ${lastError.message}`;
    console.error(errorMessage, { lastError });
    throw new Error(errorMessage);
  } else {
    const errorMessage = `Speech synthesis failed after ${retries} attempts with unknown error`;
    console.error(errorMessage, { lastError });
    throw new Error(errorMessage);
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
      const audio = new Audio();
      audio.preload = 'auto';  // Ensure audio is preloaded
      audio.volume = 1.0;
      
      // Set up event handlers before setting src to prevent race conditions
      const cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
      };

      // Handle successful loading
      audio.oncanplaythrough = () => {
        console.log('Audio loaded and ready to play');
        // Start playback only after we're sure the audio is ready
        audio.play().catch(playError => {
          cleanup();
          console.error('Playback failed after loading:', playError);
          audioCache.delete(cacheKey);
          reject(new Error('Failed to start audio playback after loading'));
        });
      };

      // Handle successful playback completion
      audio.onended = () => {
        cleanup();
        console.log('Audio playback completed successfully');
        resolve();
      };

      // Handle playback errors
      audio.onerror = (event) => {
        cleanup();
        const errorMessage = audio.error ? audio.error.message : 'Unknown audio playback error';
        console.error('Audio playback error:', {
          error: audio.error,
          message: errorMessage,
          code: audio.error?.code,
        });
        audioCache.delete(cacheKey);
        reject(new Error(`Failed to play audio: ${errorMessage}`));
      };

      // Handle playback abortion
      audio.onabort = () => {
        cleanup();
        console.warn('Audio playback aborted');
        reject(new Error('Audio playback aborted'));
      };

      // Set the source and begin loading
      console.log('Setting up audio source:', audioUrl);
      audio.src = audioUrl;
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
