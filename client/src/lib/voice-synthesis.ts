import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";

type VoiceModel = "tts-1";
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer" | "nova";
type EmotionType = "neutral" | "excited" | "apologetic" | "professional" | "friendly" | "confirmative";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private speakPromise: Promise<void> | null = null;
  private lastSpeakTime: number = 0;
  private readonly MIN_INTERVAL = 300;
  private readonly SYNTHESIS_TIMEOUT = 8000;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new AudioContext();
      this.audioContext.suspend();
    }

    const resumeAudioContext = () => {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume()
          .then(() => console.log('AudioContext resumed successfully'))
          .catch(error => console.error('Failed to resume AudioContext:', error));
      }
    };

    ['click', 'touchstart', 'keydown'].forEach(eventType => {
      document.addEventListener(eventType, resumeAudioContext, { once: true });
    });
  }

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  // Enhanced voice configuration based on emotion
  private getVoiceConfig(emotion: EmotionType): { voice: VoiceId; speed: number } {
    // Always use Nova voice with different speeds and intonations for emotions
    switch (emotion) {
      case "professional":
        return { voice: "nova", speed: 1.0 }; // Clear, authoritative tone
      case "friendly":
        return { voice: "nova", speed: 1.05 }; // Slightly faster, warm tone
      case "excited":
        return { voice: "nova", speed: 1.1 }; // Faster, energetic tone
      case "apologetic":
        return { voice: "nova", speed: 0.95 }; // Slower, empathetic tone
      case "confirmative":
        return { voice: "nova", speed: 1.0 }; // Clear, confident tone
      case "neutral":
      default:
        return { voice: "nova", speed: 1.0 }; // Balanced tone
    }
  }

  // Enhanced speech synthesis with professional variations
  async speak(text: string, emotion: EmotionType = "professional") {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    const now = Date.now();
    if (now - this.lastSpeakTime < this.MIN_INTERVAL) {
      console.log('Speech request too soon, skipping:', text);
      return;
    }

    console.log('Starting speech synthesis:', {
      text,
      emotion,
      timestamp: new Date().toISOString()
    });

    this.stop();
    this.lastSpeakTime = now;

    const { voice, speed } = this.getVoiceConfig(emotion);

    try {
      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: this.enhanceText(text, emotion),
        speed
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
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
    } catch (error: any) {
      console.error('Speech synthesis error:', error);
      const errorMessage = error.message || 'Unknown speech synthesis error';
      throw new Error(`Speech synthesis failed: ${errorMessage}`);
    }
  }

  // Enhanced text processing for more natural speech
  private enhanceText(text: string, emotion: EmotionType): string {
    // Add subtle variations and professional touches based on emotion
    switch (emotion) {
      case "professional":
        return text.replace(/^/g, "Certainly. ").replace(/\.$/, ".");
      case "friendly":
        return text.replace(/^/g, "Great! ").replace(/\.$/, ".");
      case "excited":
        return text.replace(/^/g, "Excellent! ").replace(/\.$/, "!");
      case "apologetic":
        return text.replace(/^/g, "I apologize, ").replace(/\.$/, ".");
      case "confirmative":
        return text.replace(/^/g, "Perfect. ").replace(/\.$/, ".");
      default:
        return text;
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