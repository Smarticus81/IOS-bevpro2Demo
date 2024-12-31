import OpenAI from "openai";

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

interface OrderItem {
  name: string;
  quantity: number;
  modifiers?: string[];
}

interface OrderDetails {
  items: OrderItem[];
  specialInstructions?: string;
  action?: 'complete_order' | 'help' | 'stop';
}

interface VoiceOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
}

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

// Improved completion command detection
function normalizeCommand(text: string): string {
  let normalized = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')                           // Normalize spaces
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

  return normalized;
}

// Local command processing for better latency
function processSimpleCommands(text: string): OrderDetails | null {
  const normalizedCommand = normalizeCommand(text);

  const now = Date.now();
  if (normalizedCommand === lastProcessedCommand && now - lastProcessedTimestamp < COMMAND_DEBOUNCE_TIME) {
    console.log('Duplicate command detected, skipping:', normalizedCommand);
    return null;
  }

  // Completion phrases
  const completionPhrases = [
    'complete', 'finish', 'done', 'checkout', 'pay',
    'confirm', 'process', 'submit', 'place order',
    'thats it', "that's it", 'process order', 'complete order',
    'okay thats it', "okay that's it"
  ];

  // Check for completion command
  if (completionPhrases.some(phrase => normalizedCommand.includes(phrase))) {
    lastProcessedCommand = normalizedCommand;
    lastProcessedTimestamp = now;
    return {
      items: [],
      action: 'complete_order'
    };
  }

  // Help command patterns
  if (/^(help|commands|what|menu)/.test(normalizedCommand) || 
      normalizedCommand.includes('what can') || 
      normalizedCommand.includes('how do')) {
    lastProcessedCommand = normalizedCommand;
    lastProcessedTimestamp = now;
    return {
      items: [],
      action: 'help'
    };
  }

  // Stop/cancel patterns
  if (/^(stop|end|quit|exit|cancel)/.test(normalizedCommand) || 
      normalizedCommand.includes('never mind') || 
      normalizedCommand.includes('cancel that')) {
    lastProcessedCommand = normalizedCommand;
    lastProcessedTimestamp = now;
    return {
      items: [],
      action: 'stop'
    };
  }

  return null;
}

// Deduplicate and normalize order items
function consolidateOrderItems(items: OrderItem[]): OrderItem[] {
  const itemMap = new Map<string, OrderItem>();

  items.forEach(item => {
    const normalizedName = item.name.toLowerCase().trim();
    const existingItem = itemMap.get(normalizedName);

    if (existingItem) {
      // For duplicates, keep the most reasonable quantity
      const combinedQuantity = Math.min(
        item.quantity, // New quantity
        existingItem.quantity, // Existing quantity
        12 // Hard limit
      );
      existingItem.quantity = combinedQuantity;
    } else {
      // Add new item with normalized quantity
      itemMap.set(normalizedName, {
        ...item,
        name: item.name,
        quantity: Math.min(12, Math.max(1, item.quantity))
      });
    }
  });

  return Array.from(itemMap.values());
}

async function processComplexOrder(text: string): Promise<OrderDetails> {
  if (!openai) throw new Error('Voice processing service is not configured');

  // Normalize command and check for duplicates
  const normalizedCommand = normalizeCommand(text);
  const now = Date.now();

  if (normalizedCommand === lastProcessedCommand && now - lastProcessedTimestamp < COMMAND_DEBOUNCE_TIME) {
    console.log('Duplicate complex order detected, skipping:', normalizedCommand);
    return { items: [] };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `Extract drink orders from voice commands.
          Return a JSON object with: {
            "items": [{ "name": string, "quantity": number }],
            "action": "complete_order" | null
          }
          Rules:
          - Extract exact quantities (1-12 only)
          - Keep drink names exact as spoken
          - Ignore filler words like "please", "get", "would like"
          - Do not duplicate items
          - Do not infer quantities, use exactly what was spoken
          - If no quantity specified, default to 1
          - Maximum quantity per item is 12
          - Detect phrases like "that's it" or "complete order" as completion commands`
      },
      {
        role: "user",
        content: normalizedCommand
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 150
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  lastProcessedCommand = normalizedCommand;
  lastProcessedTimestamp = now;

  if (parsed.items) {
    // Normalize and deduplicate items
    parsed.items = consolidateOrderItems(parsed.items);
  }

  return parsed;
}

export async function processVoiceOrder(text: string): Promise<VoiceOrderResult> {
  if (!text) {
    return {
      success: false,
      error: 'No command received'
    };
  }

  try {
    // First try processing simple commands locally
    const simpleOrder = processSimpleCommands(text);
    if (simpleOrder) {
      console.log('Simple command processed:', simpleOrder);
      return {
        success: true,
        order: simpleOrder
      };
    }

    // Process complex order with quantity validation
    const orderDetails = await processComplexOrder(text);
    console.log('Complex order processed:', orderDetails);

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