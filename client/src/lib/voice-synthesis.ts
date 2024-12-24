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
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

  private constructor() {
    console.log('VoiceSynthesis constructor called');
    this.setupInitialization();
  }

  private setupInitialization() {
    this.initializationPromise = new Promise((resolve) => {
      const initializeAudio = async () => {
        try {
          console.log('Attempting audio initialization...');
          if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
            console.warn('Maximum initialization attempts reached');
            return;
          }

          this.initializationAttempts++;
          await this.initializeAudioContext();

          ['click', 'touchstart', 'keydown'].forEach(type => {
            document.removeEventListener(type, initializeAudio);
          });

          console.log('Audio initialization successful');
          resolve();
        } catch (error) {
          console.error('Audio initialization failed:', error);
          // Keep listeners active to retry on next interaction
        }
      };

      ['click', 'touchstart', 'keydown'].forEach(type => {
        document.addEventListener(type, initializeAudio, { once: true });
      });

      // Attempt immediate initialization for browsers that don't require user interaction
      initializeAudio().catch(console.error);
    });
  }

  static getInstance(): VoiceSynthesis {
    if (!VoiceSynthesis.instance) {
      console.log('Creating new VoiceSynthesis instance');
      VoiceSynthesis.instance = new VoiceSynthesis();
    }
    return VoiceSynthesis.instance;
  }

  private async initializeAudioContext(): Promise<void> {
    if (this.isAudioInitialized && this.audioContext?.state === 'running') {
      console.log('AudioContext already initialized and running');
      return;
    }

    console.log('Initializing AudioContext...');
    try {
      // Create new context if none exists or if current one is closed
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContext();
        console.log('New AudioContext created');
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContext resumed successfully');
      }

      // Verify the context is actually running
      if (this.audioContext.state !== 'running') {
        throw new Error(`AudioContext state is ${this.audioContext.state}`);
      }

      this.isAudioInitialized = true;
      console.log('Audio context fully initialized and running');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      this.isAudioInitialized = false;
      throw error;
    }
  }

  async waitForInitialization(): Promise<void> {
    if (!this.initializationPromise) {
      console.warn('Voice synthesis not properly initialized, retrying setup');
      this.setupInitialization();
    }
    return this.initializationPromise;
  }

  async speak(text: string, voice: VoiceId = "alloy", emotion: "neutral" | "excited" | "apologetic" = "neutral"): Promise<void> {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    try {
      console.log('Attempting to speak:', { text: text.substring(0, 50) + '...', voice, emotion });
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

      console.log('Generating speech with OpenAI...', { voice: voiceSelection, speed: speechSpeed });
      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
      });

      console.log('Speech generated successfully, preparing for playback');
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      this.stop();

      return new Promise<void>((resolve, reject) => {
        console.log('Setting up audio playback...');
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
          console.log('Audio playback completed successfully');
          cleanup();
          resolve();
        };

        const onError = (error: Event) => {
          console.error('Audio playback failed:', error);
          cleanup();
          reject(new Error('Audio playback failed'));
        };

        this.currentAudio.addEventListener('ended', onEnded);
        this.currentAudio.addEventListener('error', onError);

        console.log('Starting audio playback...');
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
      console.log('Stopping current audio playback');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isReady(): boolean {
    const ready = this.isAudioInitialized && !!this.audioContext && this.audioContext.state === 'running';
    console.log('Voice synthesis ready state:', { 
      initialized: this.isAudioInitialized,
      contextExists: !!this.audioContext,
      contextState: this.audioContext?.state,
      ready
    });
    return ready;
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();