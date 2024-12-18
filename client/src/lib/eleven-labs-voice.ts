import { generate, type GenerateOptions, type VoiceSettings } from 'elevenlabs-node';

class ElevenLabsVoiceProvider {
  private static instance: ElevenLabsVoiceProvider;
  private apiKey: string | null = null;
  private voiceId: string = "21m00Tcm4TlvDq8ikWAM"; // default voice ID (Rachel)
  private modelId: string = "eleven_multilingual_v2";
  
  private constructor() {}

  static getInstance(): ElevenLabsVoiceProvider {
    if (!ElevenLabsVoiceProvider.instance) {
      ElevenLabsVoiceProvider.instance = new ElevenLabsVoiceProvider();
    }
    return ElevenLabsVoiceProvider.instance;
  }

  initialize(apiKey: string) {
    this.apiKey = apiKey;
    console.log('ElevenLabs voice provider initialized');
  }

  async speak(text: string): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('Synthesizing speech with ElevenLabs:', {
      text,
      voiceId: this.voiceId,
      timestamp: new Date().toISOString()
    });

    const options: GenerateOptions = {
      apiKey: this.apiKey,
      textInput: text,
      voiceId: this.voiceId,
      modelId: this.modelId,
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
      }
    };

    try {
      const response = await generate(options);
      return await response.arrayBuffer();
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw new Error('Speech synthesis failed');
    }
  }

  setVoice(voiceId: string) {
    this.voiceId = voiceId;
  }

  isInitialized(): boolean {
    return this.apiKey !== null;
  }
}

export const elevenLabsVoice = ElevenLabsVoiceProvider.getInstance();
