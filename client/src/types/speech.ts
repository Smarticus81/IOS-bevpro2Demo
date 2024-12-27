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