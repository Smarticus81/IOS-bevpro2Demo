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
  customizations?: string[];
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

// Improved completion command detection
const completionPhrases = [
  'complete', 'finish', 'done', 'checkout', 'pay',
  'confirm', 'process', 'submit', 'place order',
  'thats it', "that's it", 'process order', 'complete order',
  'okay thats it', "okay that's it"
];

// Local command processing for better latency
function processSimpleCommands(text: string): OrderDetails | null {
  const command = text.toLowerCase().trim();

  // Enhanced completion command detection with better phrase matching
  const isCompletionCommand = completionPhrases.some(phrase => 
    command.includes(phrase) || 
    command.endsWith(phrase) || 
    command.startsWith(phrase)
  );

  if (isCompletionCommand) {
    return {
      items: [],
      action: 'complete_order'
    };
  }

  // Process help commands with enhanced patterns
  if (command.match(/^(help|commands|what|assistance|options|menu)/) || 
      command.includes('what can') || 
      command.includes('how do')) {
    return {
      items: [],
      action: 'help'
    };
  }

  // Process stop commands with enhanced patterns
  if (command.match(/^(stop|end|quit|exit|cancel)/) || 
      command.includes('never mind') || 
      command.includes('cancel that')) {
    return {
      items: [],
      action: 'stop'
    };
  }

  return null;
}

function normalizeQuantity(text: string): number {
  const numbers: { [key: string]: number } = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'a': 1, 'an': 1
  };

  // Convert word numbers to digits
  let normalized = text.toLowerCase();
  Object.entries(numbers).forEach(([word, num]) => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), num.toString());
  });

  // Extract the first number found
  const match = normalized.match(/\b(\d{1,2})\b/);
  if (match) {
    const num = parseInt(match[1]);
    // Sanity check - limit to reasonable quantities
    return num > 0 && num <= 12 ? num : 1;
  }

  return 1; // Default to 1 if no valid number found
}

async function processComplexOrder(text: string): Promise<OrderDetails> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `Extract order details from customer voice commands.
          Return a JSON object with: {
            "items": [{ "name": string, "quantity": number (1-12 only) }],
            "specialInstructions": string,
            "action": "complete_order" | null
          }
          Prioritize accurate quantity parsing and drink name matching.
          Keep quantities reasonable (1-12).
          Avoid duplicating items.
          Pay special attention to completion phrases like "that's it", "finish order".
          Keep responses concise and focused on order details only.`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 150 
  });

  const parsed = JSON.parse(completion.choices[0].message.content);

  // Validate and normalize quantities
  if (parsed.items) {
    parsed.items = parsed.items.map((item: OrderItem) => ({
      ...item,
      quantity: Math.min(12, Math.max(1, item.quantity)) // Ensure quantity is between 1 and 12
    }));
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
    // First try processing simple commands locally for better latency
    const simpleOrder = processSimpleCommands(text);
    if (simpleOrder) {
      console.log('Simple command processed:', simpleOrder);
      return {
        success: true,
        order: simpleOrder
      };
    }

    // Extract quantity from text before AI processing
    const quantity = normalizeQuantity(text);
    console.log('Detected quantity:', quantity);

    // Fall back to AI processing for complex orders
    const orderDetails = await processComplexOrder(text);
    console.log('Complex order processed:', orderDetails);

    // Apply quantity normalization to all items
    if (orderDetails.items) {
      orderDetails.items = orderDetails.items.map(item => ({
        ...item,
        quantity: Math.min(12, Math.max(1, item.quantity))
      }));
    }

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