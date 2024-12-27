import type { VoiceError } from "@/types/speech";
import { getOpenAIClient } from "./openai";
import { googleVoiceService } from "./google-voice-service";
import type { VoiceResponse, VoiceId } from "@/types/speech";

class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isAudioInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;
  private isSpeaking: boolean = false;
  private isInitializing: boolean = false;

  private constructor() {
    this.setupInitialization();
  }

  private setupInitialization() {
    this.initializationPromise = new Promise((resolve) => {
      const initializeAudio = async () => {
        if (this.isInitializing) return;

        try {
          this.isInitializing = true;

          if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
            console.warn('Maximum initialization attempts reached');
            return;
          }

          this.initializationAttempts++;
          await this.initializeAudioContext();

          // Remove event listeners only after successful initialization
          ['click', 'touchstart', 'keydown'].forEach(type => {
            document.removeEventListener(type, initializeAudio);
          });

          resolve();
        } catch (error) {
          console.error('Audio initialization failed:', error);
        } finally {
          this.isInitializing = false;
        }
      };

      // Add event listeners for user interaction
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
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new window.AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (this.audioContext.state !== 'running') {
        throw new Error(`AudioContext state is ${this.audioContext.state}`);
      }

      this.isAudioInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      this.isAudioInitialized = false;
      throw error;
    }
  }

  async speak(response: VoiceResponse | string): Promise<void> {
    const text = typeof response === 'string' ? response : response.text;
    const emotion = typeof response === 'string' ? 'neutral' : response.emotion;

    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }


    if (this.isSpeaking) {
      this.stop();
    }

    try {
      await this.waitForInitialization();

      // Store current recognition state
      const wasListening = googleVoiceService.isActive();
      if (wasListening) {
        await googleVoiceService.pauseListening();
      }

      this.isSpeaking = true;

      // Configure voice based on emotion
      let speechSpeed = 1.0;
      let voiceSelection: VoiceId = 'alloy';

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
      const audioResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
      });

      const arrayBuffer = await audioResponse.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      this.stop();

      return new Promise<void>((resolve, reject) => {
        this.currentAudio = new Audio(url);

        const cleanup = async () => {
          URL.revokeObjectURL(url);
          if (this.currentAudio) {
            this.currentAudio.removeEventListener('ended', onEnded);
            this.currentAudio.removeEventListener('error', onError);
            this.currentAudio = null;
          }
          this.isSpeaking = false;

          // Resume speech recognition if it was active before
          if (wasListening) {
            try {
              await googleVoiceService.resumeListening();
            } catch (error) {
              console.error('Failed to resume speech recognition:', error);
            }
          }
        };

        const onEnded = async () => {
          await cleanup();
          resolve();
        };

        const onError = async (error: Event) => {
          await cleanup();
          reject(new Error('Audio playback failed'));
        };

        this.currentAudio.addEventListener('ended', onEnded);
        this.currentAudio.addEventListener('error', onError);

        this.currentAudio.play().catch(async error => {
          await cleanup();
          reject(error);
        });
      });
    } catch (error) {
      console.error('Speech synthesis error:', error);
      this.isSpeaking = false;
      throw error;
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
  }

  isReady(): boolean {
    return this.isAudioInitialized && 
           !!this.audioContext && 
           this.audioContext.state === 'running';
  }

  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  private async waitForInitialization(): Promise<void> {
    if (!this.initializationPromise) {
      this.setupInitialization();
    }

    try {
      await this.initializationPromise;
    } catch (error) {
      console.error('Error waiting for initialization:', error);
      throw error;
    }
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();