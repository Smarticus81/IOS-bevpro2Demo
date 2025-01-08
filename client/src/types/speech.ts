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

// Expanded intent types to include inventory management
export type InventoryQueryType = 'stock_level' | 'low_stock' | 'category' | 'search';

export interface InventoryQuery {
  type: 'inventory_query';
  queryType: InventoryQueryType;
  searchTerm?: string;
  category?: string;
  conversational_response: string;
}

export interface InventoryAction {
  type: 'inventory_action';
  action: 'update_stock' | 'mark_low' | 'add_item' | 'remove_item';
  itemId?: number;
  itemName?: string;
  quantity?: number;
  conversational_response: string;
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

// Voice feedback and interaction types
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

// Update Intent type to include inventory intents
export type Intent = (
  | OrderIntent 
  | IncompleteOrderIntent 
  | QueryIntent 
  | GreetingIntent 
  | CompleteTransactionIntent 
  | ShutdownIntent 
  | CancelIntent 
  | InventoryQuery 
  | InventoryAction
) & BaseIntent;