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
}

interface VoiceOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
}

// Local command processing for better latency
function processSimpleCommands(text: string): OrderDetails | null {
  const command = text.toLowerCase().trim();

  // Process completion commands
  if (/^(complete|finish|done|checkout|pay|confirm|process|submit)(\s+order)?$/.test(command)) {
    return {
      items: [],
      specialInstructions: 'complete_order'
    };
  }

  // Process help commands
  if (/^(help|commands|what can (i|you) do)$/.test(command)) {
    return {
      items: [],
      specialInstructions: 'help_requested'
    };
  }

  // Process stop commands
  if (/^(stop|end|quit|exit)$/.test(command)) {
    return {
      items: [],
      specialInstructions: 'stop_requested'
    };
  }

  return null;
}

async function processComplexOrder(text: string): Promise<OrderDetails> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Using latest model for faster processing
    messages: [
      {
        role: "system",
        content: `Extract order details from customer voice commands.
          Return a JSON object with: {
            "items": [{ "name": string, "quantity": number }],
            "specialInstructions": string
          }
          Keep responses concise and focused on order details only.`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 150 // Reduced for faster response
  });

  return JSON.parse(completion.choices[0].message.content);
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
      return {
        success: true,
        order: simpleOrder
      };
    }

    // Fall back to AI processing for complex orders
    const orderDetails = await processComplexOrder(text);
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