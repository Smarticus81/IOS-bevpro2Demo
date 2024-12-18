import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";

type VoiceModel = "tts-1";
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private speakPromise: Promise<void> | null = null;
  private lastSpeakTime: number = 0;
  private readonly MIN_INTERVAL = 300; // Minimum time between speeches in ms
  private readonly SYNTHESIS_TIMEOUT = 5000; // Maximum time to wait for synthesis

  private constructor() {
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
    }, { once: true });
  }

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  async speak(text: string, voice: VoiceId = "alloy") {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    const now = Date.now();
    if (now - this.lastSpeakTime < this.MIN_INTERVAL) {
      console.log('Speech request too soon, skipping:', text);
      return;
    }
    
    // Clean up any existing audio before starting new synthesis
    this.stop();

    this.lastSpeakTime = now;

    // Create a timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Speech synthesis timeout'));
      }, this.SYNTHESIS_TIMEOUT);
    });

    // Create the synthesis promise
    const synthesisPromise = async () => {
      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
        speed: 1.2
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      return new Promise<void>((resolve, reject) => {
        this.currentAudio = new Audio(url);
        
        this.currentAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          resolve();
        });

        this.currentAudio.addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          reject(e);
        });

        this.currentAudio.play().catch(error => {
          console.error('Failed to play audio:', error);
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          reject(error);
        });
      });
    };

    try {
      // Race between timeout and synthesis
      this.speakPromise = Promise.race([synthesisPromise(), timeoutPromise]);
      await this.speakPromise;
    } catch (error) {
      console.error('Speech synthesis error:', error);
      this.speakPromise = null;
      throw error;
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();
