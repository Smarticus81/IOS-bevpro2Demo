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
    console.log('VoiceSynthesis constructor called');
    this.setupInitialization();
  }

  private setupInitialization() {
    console.log('Setting up voice synthesis initialization...');
    this.initializationPromise = new Promise((resolve) => {
      const initializeAudio = async () => {
        if (this.isInitializing) {
          console.log('Already initializing, waiting...');
          return;
        }

        try {
          this.isInitializing = true;
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
        } finally {
          this.isInitializing = false;
        }
      };

      ['click', 'touchstart', 'keydown'].forEach(type => {
        document.addEventListener(type, initializeAudio, { once: true });
      });

      // Initial attempt
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
    console.log('Initializing AudioContext...', {
      isInitialized: this.isAudioInitialized,
      currentState: this.audioContext?.state
    });

    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new window.AudioContext();
        console.log('New AudioContext created');
      }

      if (this.audioContext.state === 'suspended') {
        console.log('Resuming suspended AudioContext...');
        await this.audioContext.resume();
        console.log('AudioContext resumed successfully');
      }

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

    try {
      await this.initializationPromise;
    } catch (error) {
      console.error('Error waiting for initialization:', error);
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

    console.log('Voice synthesis state before speaking:', {
      isInitialized: this.isAudioInitialized,
      contextState: this.audioContext?.state,
      isSpeaking: this.isSpeaking
    });

    if (this.isSpeaking) {
      console.log('Already speaking, stopping current playback');
      this.stop();
    }

    try {
      console.log('Attempting to speak:', { 
        text: text.substring(0, 50) + '...', 
        emotion,
        data: typeof response === 'string' ? undefined : response.data
      });

      await this.waitForInitialization();

      // Store current recognition state
      const wasListening = googleVoiceService.isActive();
      if (wasListening) {
        console.log('Temporarily pausing speech recognition for synthesis');
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

      console.log('Generating speech with OpenAI...', { voice: voiceSelection, speed: speechSpeed });

      const openai = await getOpenAIClient();
      const audioResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
      });

      console.log('Speech generated successfully, preparing for playback');
      const arrayBuffer = await audioResponse.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      this.stop();

      return new Promise<void>((resolve, reject) => {
        console.log('Setting up audio playback...');
        this.currentAudio = new Audio(url);

        const cleanup = async () => {
          console.log('Cleaning up audio resources...');
          URL.revokeObjectURL(url);
          if (this.currentAudio) {
            this.currentAudio.removeEventListener('ended', onEnded);
            this.currentAudio.removeEventListener('error', onError);
            this.currentAudio = null;
          }
          this.isSpeaking = false;

          // Resume speech recognition if it was active before
          if (wasListening) {
            console.log('Resuming speech recognition after synthesis');
            try {
              await googleVoiceService.resumeListening();
            } catch (error) {
              console.error('Failed to resume speech recognition:', error);
            }
          }
        };

        const onEnded = async () => {
          console.log('Audio playback completed successfully');
          await cleanup();
          resolve();
        };

        const onError = async (error: Event) => {
          console.error('Audio playback failed:', error);
          await cleanup();
          reject(new Error('Audio playback failed'));
        };

        this.currentAudio.addEventListener('ended', onEnded);
        this.currentAudio.addEventListener('error', onError);

        console.log('Starting audio playback...');
        this.currentAudio.play().catch(async error => {
          console.error('Failed to play audio:', error);
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
      console.log('Stopping current audio playback');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
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

  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();