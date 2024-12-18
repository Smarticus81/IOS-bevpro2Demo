import OpenAI from "openai";
import { getOpenAIClient } from "./openai";

export class VoiceSynthesis {
  private static instance: VoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private audioQueue: Array<{ text: string; voice: string }> = [];
  private isPlaying = false;

  private constructor() {
    // Initialize Web Audio API context on first user interaction
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

  private async createAudioElement(arrayBuffer: ArrayBuffer): Promise<HTMLAudioElement> {
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    // Clean up object URL after audio is loaded
    audio.addEventListener('ended', () => URL.revokeObjectURL(url));
    return audio;
  }

  private async processQueue() {
    if (this.isPlaying || this.audioQueue.length === 0) return;

    this.isPlaying = true;
    const { text, voice } = this.audioQueue.shift()!;

    try {
      const openai = await getOpenAIClient();
      
      const response = await openai.audio.speech.create({
        model: "nova",
        voice: voice,
        input: text,
      });

      const arrayBuffer = await response.arrayBuffer();
      const audio = await this.createAudioElement(arrayBuffer);

      audio.addEventListener('ended', () => {
        this.isPlaying = false;
        this.processQueue();
      });

      await audio.play();
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      this.isPlaying = false;
      this.processQueue();
    }
  }

  async speak(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova") {
    if (!text) return;

    this.audioQueue.push({ text, voice });
    if (!this.isPlaying) {
      await this.processQueue();
    }
  }

  clearQueue() {
    this.audioQueue = [];
  }
}

export const voiceSynthesis = VoiceSynthesis.getInstance();
