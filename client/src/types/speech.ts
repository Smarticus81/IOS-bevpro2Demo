// Common interfaces for voice interactions
export interface DrinkItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

export interface CartItem {
  drink: DrinkItem;
  quantity: number;
}

export interface AddToCartAction {
  type: 'ADD_ITEM';
  drink: DrinkItem;
  quantity: number;
}

export interface VoiceRecognitionCallback {
  (text: string): void;
}

export interface VoiceError extends Error {
  code?: string;
  name: string;
}

// Only keeping essential types for voice recognition
export type ErrorType = 'network' | 'recognition' | 'processing';

export interface RecognitionError {
  type: ErrorType;
  message: string;
}

// Navigation related types
export interface NavigationCommand {
  command: string;
  path: string;
  description: string;
  icon?: string;
}

export interface NavigationAction {
  type: 'navigation';
  path: string;
}

// Voice command customization
export interface VoiceCommandPreference {
  command: string;
  action: 'order' | 'inquiry' | 'modify' | 'cancel' | 'system' | 'navigation';
  aliases: string[];
  enabled: boolean;
}

export interface VoiceSettings {
  wakeWord: string;
  volume: number;
  commandPreferences: VoiceCommandPreference[];
  navigationShortcuts?: NavigationCommand[];
}

export interface VoiceCustomization {
  settings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  resetSettings: () => void;
}