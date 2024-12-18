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

  async speak(text: string, voice: VoiceId = "alloy") {
    // Avoid duplicate responses
    if (text === this.lastProcessedText) {
      console.log('Skipping duplicate text:', text);
      return;
    }
    this.lastProcessedText = text;

    // Stop any current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    try {
      const openai = await getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
        speed: 1.2 // Slightly faster speech
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      this.currentAudio = new Audio(url);
      this.currentAudio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
      });

      await this.currentAudio.play();
    } catch (error) {
      console.error('Speech synthesis error:', error);
    }
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
