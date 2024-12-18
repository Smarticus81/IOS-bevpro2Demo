import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Voice, VoiceSettings, generate } from 'elevenlabs-node';

export type VoiceProvider = 'openai' | 'elevenlabs' | 'google' | 'native';

export interface VoiceOptions {
  provider?: VoiceProvider;
  voice?: string;
  speed?: number;
}

class VoiceProviders {
  private static instance: VoiceProviders;
  private audioContext: AudioContext | null = null;
  private currentProvider: VoiceProvider = 'openai';
  private audioContextInitialized = false;
  
  private constructor() {
    // Initialize audio context on first user interaction
    const initAudioContext = () => {
      if (!this.audioContextInitialized) {
        console.log('Initializing AudioContext...');
        this.audioContext = new AudioContext();
        this.audioContextInitialized = true;
        console.log('AudioContext initialized:', {
          state: this.audioContext.state,
          sampleRate: this.audioContext.sampleRate,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Set up multiple triggers for audio context initialization
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
    document.addEventListener('keydown', initAudioContext, { once: true });
  }

  static getInstance(): VoiceProviders {
    if (!VoiceProviders.instance) {
      VoiceProviders.instance = new VoiceProviders();
    }
    return VoiceProviders.instance;
  }

  setProvider(provider: VoiceProvider) {
    this.currentProvider = provider;
  }

  async synthesize(text: string, options: VoiceOptions = {}): Promise<ArrayBuffer> {
    const provider = options.provider || this.currentProvider;
    
    console.log('Synthesizing speech with provider:', {
      provider,
      text,
      options,
      timestamp: new Date().toISOString()
    });

    switch (provider) {
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(text, options);
      case 'google':
        return this.synthesizeWithGoogle(text, options);
      case 'native':
        return this.synthesizeWithNative(text, options);
      case 'openai':
      default:
        return this.synthesizeWithOpenAI(text, options);
    }
  }

  private async synthesizeWithElevenLabs(text: string, options: VoiceOptions): Promise<ArrayBuffer> {
    try {
      const voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.5,
        use_speaker_boost: true
      };

      const voiceId = options.voice || 'pNInz6obpgDQGcFmaJgB'; // Default to 'Josh' voice
      const response = await generate({
        apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || '',
        textInput: text,
        voiceId,
        modelId: 'eleven_monolingual_v1',
        voiceSettings
      });

      return response.arrayBuffer();
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw new Error('ElevenLabs synthesis failed');
    }
  }

  private async synthesizeWithGoogle(text: string, options: VoiceOptions): Promise<ArrayBuffer> {
    try {
      const client = new TextToSpeechClient();
      
      const request = {
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: options.voice || 'en-US-Neural2-F'
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: options.speed || 1.0
        },
      };

      const [response] = await client.synthesizeSpeech(request);
      return response.audioContent.buffer;
    } catch (error) {
      console.error('Google synthesis error:', error);
      throw new Error('Google synthesis failed');
    }
  }

  private async synthesizeWithNative(text: string, options: VoiceOptions): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.speed || 1.0;
        
        if (options.voice) {
          const voices = window.speechSynthesis.getVoices();
          const selectedVoice = voices.find(v => v.name === options.voice);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }

        // Convert native speech synthesis to audio buffer
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        oscillator.connect(mediaStreamDestination);
        
        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        const audioChunks: BlobPart[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          resolve(arrayBuffer);
        };
        
        mediaRecorder.start();
        window.speechSynthesis.speak(utterance);
        
        utterance.onend = () => {
          mediaRecorder.stop();
          oscillator.stop();
        };
        
        oscillator.start();
      } catch (error) {
        console.error('Native synthesis error:', error);
        reject(new Error('Native synthesis failed'));
      }
    });
  }

  private async synthesizeWithOpenAI(text: string, options: VoiceOptions): Promise<ArrayBuffer> {
    try {
      // Connect to realtime WebSocket endpoint
      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/realtime`);
      
      return new Promise((resolve, reject) => {
        const audioChunks: Uint8Array[] = [];
        
        ws.onopen = () => {
          console.log('Connected to realtime synthesis WebSocket');
          ws.send(JSON.stringify({
            type: 'synthesis',
            text,
            voice: options.voice || 'alloy',
            speed: options.speed || 1.2
          }));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'error') {
              reject(new Error(data.error));
              return;
            }
            
            if (data.type === 'audio') {
              // Convert base64 to Uint8Array
              const chunk = new Uint8Array(atob(data.chunk)
                .split('')
                .map(char => char.charCodeAt(0)));
              audioChunks.push(chunk);
            }
            
            if (data.type === 'end') {
              // Combine all chunks into a single ArrayBuffer
              const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
              const combined = new Uint8Array(totalLength);
              let offset = 0;
              
              for (const chunk of audioChunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
              }
              
              resolve(combined.buffer);
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
        };

        // Add timeout
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
            reject(new Error('Synthesis timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('OpenAI synthesis error:', error);
      throw new Error('OpenAI synthesis failed');
    }
  }

  async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      return new Promise((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      throw new Error('Failed to play audio');
    }
  }
}

export const voiceProviders = VoiceProviders.getInstance();
