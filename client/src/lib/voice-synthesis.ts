import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";

type VoiceModel = "tts-1";
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isAudioInitialized: boolean = false;
  private readonly MIN_INTERVAL = 300; // Minimum time between speeches in ms
  private readonly SYNTHESIS_TIMEOUT = 8000; // Maximum time to wait for synthesis

  private constructor() {
    // Don't create AudioContext until first user interaction
    this.initializeAudioContext = this.initializeAudioContext.bind(this);
    this.attachUserInteractionListeners();
  }

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  private attachUserInteractionListeners() {
    const initOnInteraction = (event: Event) => {
      this.initializeAudioContext();
      // Remove listeners after first interaction
      ['click', 'touchstart', 'keydown'].forEach(type => {
        document.removeEventListener(type, initOnInteraction);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach(eventType => {
      document.addEventListener(eventType, initOnInteraction);
    });
  }

  private async initializeAudioContext() {
    if (this.isAudioInitialized) return;

    try {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.isAudioInitialized = true;
      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      this.isAudioInitialized = false;
      throw new Error('Failed to initialize audio system');
    }
  }

  async speak(text: string, voice: VoiceId = "alloy", emotion: "neutral" | "excited" | "apologetic" = "neutral") {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    // Ensure audio context is initialized
    if (!this.isAudioInitialized) {
      try {
        await this.initializeAudioContext();
      } catch (error) {
        console.error('Failed to initialize audio before speaking:', error);
        return;
      }
    }

    // Apply emotional variations to speech
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

    try {
      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Clean up any existing audio
      this.stop();

      return new Promise<void>((resolve, reject) => {
        this.currentAudio = new Audio(url);

        this.currentAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          resolve();
        });

        this.currentAudio.addEventListener('error', (e) => {
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          reject(new Error('Audio playback failed'));
        });

        this.currentAudio.play().catch(error => {
          console.error('Failed to play audio:', error);
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          reject(error);
        });
      });
    } catch (error) {
      console.error('Speech synthesis error:', error);
      throw new Error('Failed to synthesize speech');
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  isReady(): boolean {
    return this.isAudioInitialized && this.audioContext?.state === 'running';
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();