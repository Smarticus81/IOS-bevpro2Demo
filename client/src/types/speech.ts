export interface VoiceRecognitionCallback {
  (text: string): void;
}

export interface VoiceError extends Error {
  code?: string;
  name: string;
}

export type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

export interface VoiceEmotions {
  neutral: {
    speed: number;
    voice: VoiceId;
  };
  excited: {
    speed: number;
    voice: VoiceId;
  };
  apologetic: {
    speed: number;
    voice: VoiceId;
  };
}

export interface VoiceSynthesisOptions {
  voice?: VoiceId;
  emotion?: keyof VoiceEmotions;
  speed?: number;
}
