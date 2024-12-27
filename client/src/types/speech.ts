// Common interfaces for voice interactions
import type { Drink } from "@db/schema";

export interface DrinkItem extends Pick<Drink, "id" | "name" | "price" | "category" | "subcategory" | "image" | "inventory"> {
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
    items?: CartItem[] | string[];
    total?: number;
    status?: string;
    error?: string;
    suggestions?: string[];
  };
  emotion: keyof VoiceEmotions;
}

// Session types for recommendations
export interface SessionContext {
  id: string;
  preferences?: {
    categories?: string[];
    tasteProfile?: {
      sweet: number;
      bitter: number;
      strong: number;
      refreshing: number;
    };
  };
  orderHistory?: CartItem[];
}