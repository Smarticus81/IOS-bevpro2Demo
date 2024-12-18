import OpenAI from "openai";
import { getOpenAIClient } from "./openai";
import type { ErrorType } from "@/types/speech";

type VoiceModel = "tts-1";
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

export class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private lastProcessedText = '';

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

  private speakPromise: Promise<void> | null = null;
  private lastSpeakTime: number = 0;
  private readonly MIN_INTERVAL = 500; // Minimum time between speeches in ms
  private readonly CLEANUP_TIMEOUT = 10000; // Maximum time to wait for audio to complete

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
    
    // Set cleanup timeout for any hanging promises
    const cleanupTimeout = setTimeout(() => {
      if (this.speakPromise) {
        console.warn('Audio playback timeout, cleaning up');
        this.stop();
      }
    }, this.CLEANUP_TIMEOUT);

    this.lastSpeakTime = now;

    // Set up new speak promise
    this.speakPromise = (async () => {
      try {
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
            this.speakPromise = null;
            resolve();
          });

          this.currentAudio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            URL.revokeObjectURL(url);
            this.currentAudio = null;
            this.speakPromise = null;
            reject(e);
          });

          this.currentAudio.play().catch(error => {
            console.error('Failed to play audio:', error);
            URL.revokeObjectURL(url);
            this.currentAudio = null;
            this.speakPromise = null;
            reject(error);
          });
        });
      } catch (error) {
        console.error('Speech synthesis error:', error);
        this.speakPromise = null;
        throw error;
      }
    })();

    return this.speakPromise;
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.lastProcessedText = '';
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();
