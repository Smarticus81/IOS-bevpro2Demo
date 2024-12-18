import type { VoiceError } from "@/types/speech";
import { voiceProviders, type VoiceProvider, type VoiceOptions } from "./voice-providers";

type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private currentAudio: HTMLAudioElement | null = null;
  private speakPromise: Promise<void> | null = null;
  private lastSpeakTime: number = 0;
  private readonly MIN_INTERVAL = 300; // Minimum time between speeches in ms
  private readonly SYNTHESIS_TIMEOUT = 8000; // Maximum time to wait for synthesis
  private currentProvider: VoiceProvider = 'openai';

  private constructor() {}

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  setProvider(provider: VoiceProvider) {
    this.currentProvider = provider;
    voiceProviders.setProvider(provider);
  }

  async speak(text: string, voice: VoiceId = "alloy", options: Partial<VoiceOptions> = {}) {
    console.log('Voice synthesis speak called:', {
      text,
      voice,
      provider: this.currentProvider,
      timestamp: new Date().toISOString()
    });

    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    const now = Date.now();
    if (now - this.lastSpeakTime < this.MIN_INTERVAL) {
      console.log('Speech request too soon, skipping:', {
        text,
        timeSinceLastSpeak: now - this.lastSpeakTime,
        minInterval: this.MIN_INTERVAL
      });
      return;
    }

    // Clean up any existing audio
    this.stop();
    this.lastSpeakTime = now;

    // Create a timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Speech synthesis timeout'));
      }, this.SYNTHESIS_TIMEOUT);
    });

    try {
      // Race between timeout and synthesis
      const synthesisPromise = async () => {
        const audioBuffer = await voiceProviders.synthesize(text, {
          provider: this.currentProvider,
          voice,
          ...options
        });
        await voiceProviders.playAudio(audioBuffer);
      };

      this.speakPromise = Promise.race([synthesisPromise(), timeoutPromise]);
      await this.speakPromise;
      
      console.log('Voice synthesis completed successfully');
    } catch (error: any) {
      console.error('Speech synthesis error:', error);
      this.speakPromise = null;

      // Try fallback providers in order
      const fallbackProviders: VoiceProvider[] = ['native', 'google', 'elevenlabs'];
      
      for (const provider of fallbackProviders) {
        try {
          console.log(`Attempting fallback to ${provider} provider`);
          const audioBuffer = await voiceProviders.synthesize(text, {
            provider,
            voice,
            ...options
          });
          await voiceProviders.playAudio(audioBuffer);
          console.log(`Fallback to ${provider} successful`);
          return;
        } catch (fallbackError) {
          console.error(`Fallback to ${provider} failed:`, fallbackError);
        }
      }

      // If all fallbacks fail, throw the original error
      throw new Error(`Speech synthesis failed: ${error.message}`);
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
