// Common interfaces for voice interactions

export interface DrinkItem {
  id: number;
  name: string;
  price: number;
  category: string;
  subcategory: string;
  image: string;
  inventory: number;
  sales: number;
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

export interface VoiceResponse {
  text: string;
  data?: {
    type: 'order_update' | 'confirmation' | 'error' | 'help' | 'cart_update';
    items?: CartItem[];
    total?: number;
    status?: string;
    error?: string;
    suggestions?: string[];
  };
  emotion: keyof VoiceEmotions;
}