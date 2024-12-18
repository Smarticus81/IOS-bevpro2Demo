declare module 'elevenlabs-node' {
  export interface VoiceSettings {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  }

  export interface GenerateOptions {
    apiKey: string;
    textInput: string;
    voiceId: string;
    modelId: string;
    voiceSettings: VoiceSettings;
  }

  export function generate(options: GenerateOptions): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;

  export type Voice = {
    voice_id: string;
    name: string;
  };
}

declare module '@google-cloud/text-to-speech' {
  export interface SynthesizeSpeechRequest {
    input: {
      text: string;
    };
    voice: {
      languageCode: string;
      name: string;
    };
    audioConfig: {
      audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
      speakingRate?: number;
    };
  }

  export interface SynthesizeSpeechResponse {
    audioContent: {
      buffer: ArrayBuffer;
    };
  }

  export class TextToSpeechClient {
    synthesizeSpeech(request: SynthesizeSpeechRequest): Promise<[SynthesizeSpeechResponse]>;
  }
}
