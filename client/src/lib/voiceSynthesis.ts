import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'default',
  dangerouslyAllowBrowser: true
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export type ValidVoice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';

export async function synthesizeSpeech(text: string, voice: ValidVoice = 'nova', retries = 3): Promise<string> {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Please check your environment variables.');
  }

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as ValidVoice,
        input: text,
        speed: voice === 'nova' ? 1.1 : 1.0, // Slightly faster for Nova
        quality: "high",
      });

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error(`Speech synthesis attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      // Only wait between retries, not after the last attempt
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Speech synthesis failed after multiple attempts');
}

// Cache for storing audio URLs
const audioCache = new Map<string, string>();

// Maximum number of cached items to keep
const MAX_CACHE_SIZE = 50;

export async function playCachedSpeech(text: string, voice: ValidVoice = 'nova'): Promise<void> {
  try {
    const cacheKey = `${text}-${voice}`;
    let audioUrl = audioCache.get(cacheKey);
    
    if (!audioUrl) {
      // Clean up old cache entries if we're at the limit
      if (audioCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = audioCache.keys().next().value;
        const oldUrl = audioCache.get(oldestKey);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
          audioCache.delete(oldestKey);
        }
      }

      audioUrl = await synthesizeSpeech(text, voice);
      audioCache.set(cacheKey, audioUrl);
    }

    const audio = new Audio(audioUrl);
    audio.volume = 1.0; // Ensure full volume for clarity
    
    // Add event listeners for error handling
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      // Remove failed audio URL from cache
      audioCache.delete(cacheKey);
      throw new Error('Failed to play audio');
    };

    await audio.play();
  } catch (error) {
    console.error('Audio playback failed:', error);
    throw error;
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
