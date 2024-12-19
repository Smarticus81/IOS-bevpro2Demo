import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'default',
  dangerouslyAllowBrowser: true
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export type ValidVoice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';

export async function synthesizeSpeech(text: string, voice: ValidVoice = 'nova'): Promise<string> {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as ValidVoice,
      input: text,
    });

    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('Speech synthesis failed:', error);
    throw error;
  }
}

// Cache for storing audio URLs
const audioCache = new Map<string, string>();

export async function playCachedSpeech(text: string, voice: ValidVoice = 'nova'): Promise<void> {
  try {
    let audioUrl = audioCache.get(`${text}-${voice}`);
    
    if (!audioUrl) {
      audioUrl = await synthesizeSpeech(text, voice);
      audioCache.set(`${text}-${voice}`, audioUrl);
    }

    const audio = new Audio(audioUrl);
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
