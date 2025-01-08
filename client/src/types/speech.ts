// Common interfaces for voice interactions
export interface DrinkItem {
  id: number;
  name: string;
  price: number;
  category: string;
  subcategory?: string;
  inventory?: number;
  image?: string;
  sales?: number;
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

// Voice specific interfaces
export interface OrderIntent {
  type: "order";
  items: Array<{ name: string; quantity: number }>;
  conversational_response: string;
}

export interface IncompleteOrderIntent {
  type: "incomplete_order";
  missing: "drink_type" | "quantity";
  quantity?: number;
  drink_type?: string;
  conversational_response: string;
}

export interface QueryIntent {
  type: "query";
  category?: string;
  attribute?: string;
  conversational_response: string;
}

export interface GreetingIntent {
  type: "greeting";
  conversational_response: string;
}

export interface CompleteTransactionIntent {
  type: "complete_transaction";
  total?: number;
  conversational_response: string;
}

export interface ShutdownIntent {
  type: "shutdown";
  conversational_response: string;
}

export interface CancelIntent {
  type: "cancel";
  conversational_response: string;
}

// Inventory specific interfaces
export type InventoryQueryType = 'stock_level' | 'low_stock' | 'category' | 'search';

export interface InventoryQueryIntent {
  type: "inventory_query";
  queryType: InventoryQueryType;
  searchTerm?: string;
  category?: string;
  conversational_response: string;
  detailed_response?: {
    itemCount?: number;
    stockStatus?: string;
    recommendations?: string[];
    urgentActions?: string[];
  };
}

export interface InventoryActionIntent {
  type: "inventory_action";
  action: "update_stock" | "mark_low" | "add_item" | "remove_item";
  itemId?: number;
  itemName?: string;
  quantity?: number;
  conversational_response: string;
  confirmation_required?: boolean;
}

export interface BaseIntent {
  sentiment: 'positive' | 'negative' | 'neutral';
  conversational_response: string;
}

// Update Intent type to include inventory intents
export type Intent = 
  | OrderIntent 
  | IncompleteOrderIntent 
  | QueryIntent 
  | GreetingIntent 
  | CompleteTransactionIntent 
  | ShutdownIntent 
  | CancelIntent 
  | InventoryQueryIntent 
  | InventoryActionIntent;

export interface VoiceRecognitionCallback {
  (text: string): void;
}

export interface VoiceError extends Error {
  code?: string;
  name: string;
}

// Error handling types
export type ErrorType = 'network' | 'recognition' | 'processing';

export interface RecognitionError {
  type: ErrorType;
  message: string;
}

// Voice command customization
export interface VoiceCommandPreference {
  command: string;
  action: 'order' | 'inquiry' | 'modify' | 'cancel' | 'system' | 'inventory';
  aliases: string[];
  enabled: boolean;
  priority?: number;
  requiresConfirmation?: boolean;
  responseTemplate?: string;
  contextualHints?: string[];
}

export interface VoiceSettings {
  wakeWord: string;
  volume: number;
  commandPreferences: VoiceCommandPreference[];
  speed: number;
  pitch: number;
  language: string;
  voiceId?: string;
  recognitionSensitivity: number;
  noiseThreshold: number;
  useBackgroundNoiseCancellation: boolean;
  confirmationMode: 'always' | 'high-value' | 'never';
  emotionalResponses: boolean;
  autocorrectEnabled: boolean;
  learningMode: boolean;
}

export interface VoiceCustomization {
  settings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  resetSettings: () => void;
}

export interface VoiceFeedback {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  visualFeedback?: boolean;
  hapticFeedback?: boolean;
  soundEffect?: string;
}

export interface CommandHistory {
  command: string;
  timestamp: number;
  success: boolean;
  context?: {
    previousItems?: string[];
    modifiedItem?: string;
    action?: string;
  };
}

export interface VoiceMetrics {
  successRate: number;
  averageResponseTime: number;
  commonErrors: Record<string, number>;
  popularCommands: string[];
  learningProgress: {
    recognizedVariations: number;
    improvedAccuracy: number;
  };
}