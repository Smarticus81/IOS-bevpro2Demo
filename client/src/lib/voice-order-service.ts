import OpenAI from "openai";
import { useQueryClient } from "@tanstack/react-query";

// Initialize OpenAI client with proper error handling
let openai: OpenAI | null = null;

try {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key not found - voice features will be limited');
  } else {
    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

// Enhanced intent types
type CommandIntent = 
  | 'add_item'           // "Add two mojitos"
  | 'remove_item'        // "Remove the last drink"
  | 'modify_item'        // "Make that three instead"
  | 'void_item'          // "Void the last order"
  | 'cancel_order'       // "Cancel this order"
  | 'split_order'        // "Split this order"
  | 'apply_discount'     // "Apply happy hour discount"
  | 'complete_order'     // "That's it"
  | 'help'              // "What can I order?"
  | 'repeat_last'        // "What was the last order?"
  | 'undo_last'         // "Undo that"
  | 'quantity_change'    // "Make that five instead"
  | 'list_orders'        // "Show my orders"
  | 'stop';             // "Stop listening"

interface OrderItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  id?: string;
  price?: number;
}

interface OrderContext {
  lastOrder?: OrderItem;
  currentItems?: OrderItem[];
  lastIntent?: CommandIntent;
  emotionalTone?: 'neutral' | 'enthusiastic' | 'apologetic' | 'frustrated';
  orderTotal?: number;
  modificationTarget?: {
    itemIndex: number;
    originalQuantity: number;
  };
  discounts?: {
    type: string;
    amount: number;
  }[];
}

interface OrderDetails {
  items: OrderItem[];
  specialInstructions?: string;
  intent: CommandIntent;
  action?: string;
  context?: OrderContext;
  modifications?: {
    type: 'add' | 'remove' | 'modify' | 'void';
    item: OrderItem;
    previousQuantity?: number;
  }[];
}

interface VoiceOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
}

// Track order context for smarter responses
let orderContext: OrderContext = {
  emotionalTone: 'neutral'
};

// Intent patterns for better command matching
const intentPatterns = {
  add_item: [
    /add|get|give|make|pour|bring|order/i,
    /(i('d| would) like|can i (get|have)|may i have)/i
  ],
  remove_item: [
    /remove|take off|delete/i,
    /don't want|remove that|take (it|that) off/i
  ],
  modify_item: [
    /change|modify|make|adjust/i,
    /instead|rather|change to|make it/i
  ],
  void_item: [
    /void|cancel|remove/i,
    /last (drink|order|item)/i
  ],
  cancel_order: [
    /cancel|void|stop|end/i,
    /(the|this|entire) order/i,
    /start over|start fresh/i
  ],
  split_order: [
    /split|divide|separate/i,
    /(the|this) order/i,
    /pay separately|split (it|check|bill)/i
  ],
  apply_discount: [
    /discount|deal|offer|special/i,
    /happy hour|promotion|coupon/i
  ],
  complete_order: [
    /complete|finish|done|that's it|checkout|confirm/i,
    /process|submit|place order|ready/i
  ],
  help: [
    /help|assist|guide|explain|what|how/i,
    /can (i|you)|what's available|menu/i
  ],
  repeat_last: [
    /repeat|what|say again|last/i,
    /what was|previous|before/i
  ],
  undo_last: [
    /undo|revert|go back|cancel that/i,
    /last (thing|action|change)/i
  ],
  quantity_change: [
    /make (it|that)|change to|instead/i,
    /(\d+|one|two|three|four|five) instead/i
  ],
  list_orders: [
    /show|list|display|what's/i,
    /(my|the|current) order/i
  ],
  stop: [
    /stop|end|quit|exit|never mind/i,
    /listening|recording|cancel/i
  ]
};

// Track processed commands to prevent duplicates
let lastProcessedCommand = '';
let lastProcessedTimestamp = 0;
const COMMAND_DEBOUNCE_TIME = 2000; // 2 seconds

// Common drink words to ignore in matching
const commonWords = ['a', 'an', 'the', 'please', 'thank', 'you', 'get', 'have', 'would', 'like', 'can', 'could', 'will'];
const numberWords = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
};

// Enhanced command normalization with intent detection
function normalizeCommand(text: string): {
  normalized: string;
  detectedIntent: CommandIntent;
} {
  let normalized = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert number words to digits
  Object.entries(numberWords).forEach(([word, num]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, num);
  });

  // Remove common filler words
  normalized = normalized.split(' ')
    .filter(word => !commonWords.includes(word))
    .join(' ');

  // Detect intent from patterns
  let detectedIntent: CommandIntent = 'add_item'; // Default intent
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => pattern.test(normalized))) {
      detectedIntent = intent as CommandIntent;
      break;
    }
  }

  return { normalized, detectedIntent };
}

// Check inventory availability
async function checkInventory(items: OrderItem[]): Promise<{ 
  available: boolean; 
  insufficientItems?: string[] 
}> {
  try {
    const response = await fetch("/api/drinks/inventory/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        items: items.map(item => ({
          drink_id: item.id,
          quantity: item.quantity
        }))
      })
    });

    if (!response.ok) {
      throw new Error("Failed to check inventory");
    }

    const result = await response.json();

    if (!result.all_available) {
      const unavailable = result.inventory_status
        .filter((status: any) => !status.is_available)
        .map((status: any) => `${status.name} (${status.available_quantity} available)`);

      return {
        available: false,
        insufficientItems: unavailable
      };
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking inventory:", error);
    throw error;
  }
}

// Enhanced order processing with context awareness
async function processComplexOrder(text: string): Promise<OrderDetails> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const { normalized: normalizedCommand, detectedIntent } = normalizeCommand(text);
  const now = Date.now();

  if (normalizedCommand === lastProcessedCommand && 
      now - lastProcessedTimestamp < COMMAND_DEBOUNCE_TIME) {
    console.log('Duplicate complex order detected, skipping:', normalizedCommand);
    return { 
      items: [], 
      intent: detectedIntent,
      context: orderContext 
    };
  }

  const emotionalTone = detectEmotionalTone(text);
  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `Process POS voice commands.
          Return a JSON object with: {
            "items": [{ 
              "name": string, 
              "quantity": number, 
              "modifiers": string[],
              "id": string
            }],
            "intent": "${Object.keys(intentPatterns).join('" | "')}", 
            "modifications": [{
              "type": "add" | "remove" | "modify" | "void",
              "item": { "name": string, "quantity": number },
              "previousQuantity": number
            }],
            "context": {
              "lastIntent": string,
              "emotionalTone": "neutral" | "enthusiastic" | "apologetic" | "frustrated",
              "orderTotal": number,
              "modificationTarget": {
                "itemIndex": number,
                "originalQuantity": number
              }
            }
          }
          Rules:
          - Extract exact quantities (1-12 only)
          - Keep drink names exact as spoken
          - Ignore filler words
          - Maximum quantity per item is 12
          - Track order context and modifications
          - Handle complex intent patterns
          - Consider emotional context
          - Support multi-turn conversations`
      },
      {
        role: "user",
        content: `Previous context: ${JSON.stringify(orderContext)}
                 Current command: ${normalizedCommand}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 150
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  lastProcessedCommand = normalizedCommand;
  lastProcessedTimestamp = now;

  // Update context
  orderContext = {
    ...orderContext,
    ...parsed.context,
    emotionalTone,
    lastIntent: parsed.intent
  };

  if (parsed.items?.length > 0) {
    orderContext.lastOrder = parsed.items[parsed.items.length - 1];
    orderContext.currentItems = parsed.items;

    try {
      const inventoryStatus = await checkInventory(parsed.items);
      if (!inventoryStatus.available) {
        throw new Error(
          `Insufficient inventory for: ${inventoryStatus.insufficientItems?.join(', ')}`
        );
      }
    } catch (error) {
      console.error('Inventory check failed:', error);
      orderContext.emotionalTone = 'apologetic';
      throw error;
    }
  }

  return {
    ...parsed,
    context: orderContext
  };
}

// Enhanced voice order processing with intent handling
export async function processVoiceOrder(text: string): Promise<VoiceOrderResult> {
  if (!text) {
    return {
      success: false,
      error: 'No command received'
    };
  }

  try {
    const orderDetails = await processComplexOrder(text);
    console.log('Voice command processed:', orderDetails);

    return {
      success: true,
      order: orderDetails
    };

  } catch (error) {
    console.error('Error processing voice order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}

// Detect emotional tone from text
function detectEmotionalTone(text: string): OrderContext['emotionalTone'] {
  const normalized = text.toLowerCase();

  if (normalized.includes('wrong') || 
      normalized.includes('no ') || 
      normalized.includes('not ') || 
      normalized.includes('incorrect')) {
    return 'frustrated';
  }

  if (normalized.includes('great') || 
      normalized.includes('perfect') || 
      normalized.includes('awesome') || 
      normalized.includes('yes')) {
    return 'enthusiastic';
  }

  if (normalized.includes('sorry') || 
      normalized.includes('oops') || 
      normalized.includes('mistake')) {
    return 'apologetic';
  }

  return 'neutral';
}