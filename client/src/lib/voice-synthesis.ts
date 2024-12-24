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
  private readonly SYNTHESIS_TIMEOUT = 8000; // Maximum time to wait for synthesis

  private constructor() {
    // Initialize context but keep it suspended until user interaction
    this.audioContext = new AudioContext();
    this.audioContext.suspend();

    // Resume audio context on any user interaction
    const resumeAudioContext = () => {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch(error => {
          console.error('Failed to resume AudioContext:', error);
        });
      }
    };

    // Listen for various user interactions
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

  async speak(text: string, voice: VoiceId = "alloy", emotion: "neutral" | "excited" | "apologetic" = "neutral") {
    if (!text?.trim()) {
      console.warn('Empty text provided to speak');
      return;
    }

    const now = Date.now();
    if (now - this.lastSpeakTime < this.MIN_INTERVAL) {
      console.log('Speech request too soon, skipping:', text);
      return;
    }
    
    console.log('Starting speech synthesis for text:', text, 'with voice:', voice, 'emotion:', emotion);
    
    // Clean up any existing audio before starting new synthesis
    this.stop();

    // Apply emotional variations to speech
    let speechSpeed = 1.2;
    let voiceSelection: VoiceId = voice;

    switch (emotion) {
      case "excited":
        speechSpeed = 1.3;
        voiceSelection = "fable"; // More energetic voice
        break;
      case "apologetic":
        speechSpeed = 1.1;
        voiceSelection = "shimmer"; // Softer voice
        break;
      default:
        voiceSelection = "alloy"; // Neutral voice
    }

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
        voice: voiceSelection,
        input: text,
        speed: speechSpeed
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
    } catch (error: any) {
      console.error('Speech synthesis error:', error);
      this.speakPromise = null;
      
      // Enhance error handling with more specific error information
      const errorMessage = error.message || 'Unknown speech synthesis error';
      if (errorMessage.includes('timeout')) {
        throw new Error('Speech synthesis timed out. Please try again.');
      } else if (error.response?.status === 429) {
        throw new Error('Too many voice requests. Please wait a moment.');
      } else if (error.code === 'PLAY_FAILED') {
        throw new Error('Failed to play audio. Please check your audio settings.');
      } else {
        throw new Error(`Speech synthesis failed: ${errorMessage}`);
      }
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
