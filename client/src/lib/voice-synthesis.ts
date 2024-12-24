import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";

type VoiceModel = "tts-1";
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isAudioInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Initialize after user interaction
    this.initializationPromise = new Promise((resolve) => {
      const initializeAudio = async () => {
        try {
          await this.initializeAudioContext();
          ['click', 'touchstart', 'keydown'].forEach(type => {
            document.removeEventListener(type, initializeAudio);
          });
          resolve();
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          // Keep listeners active to retry on next interaction
        }
      };

      ['click', 'touchstart', 'keydown'].forEach(type => {
        document.addEventListener(type, initializeAudio, { once: true });
      });
    });
  }

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  private async initializeAudioContext(): Promise<void> {
    if (this.isAudioInitialized) return;

    try {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContext resumed successfully');
      }
      this.isAudioInitialized = true;
      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      this.isAudioInitialized = false;
      throw error;
    }
  }

  async waitForInitialization(): Promise<void> {
    if (!this.initializationPromise) {
      throw new Error('Voice synthesis not properly initialized');
    }
    return this.initializationPromise;
  }

  async speak(text: string, voice: VoiceId = "alloy", emotion: "neutral" | "excited" | "apologetic" = "neutral"): Promise<void> {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    try {
      await this.waitForInitialization();

      let speechSpeed = 1.0;
      let voiceSelection: VoiceId = voice;

      switch (emotion) {
        case "excited":
          speechSpeed = 1.15;
          voiceSelection = "fable";
          break;
        case "apologetic":
          speechSpeed = 0.95;
          voiceSelection = "shimmer";
          break;
        default:
          voiceSelection = "alloy";
      }

      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);

      this.stop();

      return new Promise<void>((resolve, reject) => {
        this.currentAudio = new Audio(url);

        const cleanup = () => {
          URL.revokeObjectURL(url);
          if (this.currentAudio) {
            this.currentAudio.removeEventListener('ended', onEnded);
            this.currentAudio.removeEventListener('error', onError);
            this.currentAudio = null;
          }
        };

        const onEnded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error('Audio playback failed'));
        };

        this.currentAudio.addEventListener('ended', onEnded);
        this.currentAudio.addEventListener('error', onError);

        this.currentAudio.play().catch(error => {
          console.error('Failed to play audio:', error);
          cleanup();
          reject(error);
        });
      });
    } catch (error) {
      console.error('Speech synthesis error:', error);
      throw error;
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isReady(): boolean {
    return this.isAudioInitialized && !!this.audioContext && this.audioContext.state === 'running';
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();