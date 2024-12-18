import { getOpenAIClient } from './openai';
import type { VoiceError } from '@/types/speech';

// Use browser's native WebSocket and EventTarget
declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

class RealtimeVoiceSynthesis extends EventTarget {
  private static instance: RealtimeVoiceSynthesis;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentMode: 'order' | 'inquiry' = 'order';
  private elevenLabsInitialized = false;

  private constructor() {
    super();
    // Initialize Web Audio API context on first user interaction
    const initAudio = async () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('Audio context initialized on user interaction');
          // Initialize Eleven Labs
          await this.initializeElevenLabs();
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          throw error;
        }
      }
    };

    // Handle both click and touch events for mobile
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
  }

  static getInstance(): RealtimeVoiceSynthesis {
    if (!RealtimeVoiceSynthesis.instance) {
      RealtimeVoiceSynthesis.instance = new RealtimeVoiceSynthesis();
    }
    return RealtimeVoiceSynthesis.instance;
  }

  private async initializeElevenLabs() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      if (data.elevenLabsKey) {
        this.elevenLabsInitialized = true;
        console.log('Eleven Labs initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Eleven Labs:', error);
    }
  }

  private async initAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context initialized');
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        throw new Error('Could not initialize audio playback');
      }
    }
    return this.audioContext;
  }

  setMode(mode: 'order' | 'inquiry') {
    this.currentMode = mode;
    console.log('Voice synthesis mode set to:', mode);
  }

  async speak(text: string) {
    if (!text) {
      console.warn('Empty text provided to speak');
      return;
    }

    console.log('Synthesizing speech:', {
      text,
      mode: this.currentMode,
      elevenLabsAvailable: this.elevenLabsInitialized
    });

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: 'rachel',
          useElevenLabs: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Synthesis failed: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      if (!this.audioContext) {
        await this.initAudioContext();
      }

      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      console.log('Decoding audio data...');
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer);
      console.log('Successfully decoded audio:', {
        duration: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate
      });

      this.audioQueue.push(decodedBuffer);
      
      if (!this.isPlaying) {
        await this.playNextChunk();
      }
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to synthesize speech'
        }
      }));
      throw error;
    }
  }

  private async playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    if (!this.audioContext) {
      console.warn('Audio context not available');
      return;
    }

    try {
      this.isPlaying = true;
      const buffer = this.audioQueue.shift()!;
      
      console.log('Playing audio chunk:', {
        sampleRate: buffer.sampleRate,
        duration: buffer.duration,
        numberOfChannels: buffer.numberOfChannels,
        timestamp: new Date().toISOString()
      });

      const source = this.audioContext.createBufferSource();
      
      // Create a gain node for smooth fade in/out
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.audioContext.destination);
      
      // Connect source through gain node
      source.connect(gainNode);
      
      // Smooth fade in
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.02);
      
      source.buffer = buffer;
      source.onended = () => {
        console.log('Audio chunk playback ended');
        // Cleanup
        source.disconnect();
        gainNode.disconnect();
        
        // Play next chunk if available
        if (this.audioQueue.length > 0) {
          this.playNextChunk();
        } else {
          this.isPlaying = false;
          console.log('Finished playing all audio chunks');
        }
      };
      
      // Resume audio context if it's suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('Resumed audio context');
      }
      
      source.start();
      console.log('Started playing audio chunk');
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.isPlaying = false;
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          type: 'synthesis' as const,
          message: 'Failed to play audio'
        }
      }));
    }
  }
}

export const realtimeVoiceSynthesis = RealtimeVoiceSynthesis.getInstance();