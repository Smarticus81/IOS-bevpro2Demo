export type ErrorType = 'recognition' | 'synthesis' | 'network' | 'processing';

export interface VoiceError {
  type: ErrorType;
  message: string;
}

export interface WakeWordEvent {
  mode: 'order' | 'inquiry';
  timestamp: number;
}

export interface VoiceSettings {
  provider: 'elevenlabs' | 'webspeech';
  voiceEnabled: boolean;
  pitch: number;
  rate: number;
  volume: number;
  hasElevenLabs?: boolean;
}
