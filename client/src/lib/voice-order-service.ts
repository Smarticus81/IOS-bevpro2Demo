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

interface VoiceOrderResult {
  success: boolean;
  order?: {
    items: Array<{
      name: string;
      quantity: number;
      customizations?: string[];
    }>;
    specialInstructions?: string;
  };
  error?: string;
  isShutdown?: boolean;
}

async function processTranscription(text: string): Promise<VoiceOrderResult['order']> {
  if (!openai) throw new Error('Voice processing service is not configured');

  // Check for completion commands first
  const completionCommands = ['complete', 'finish', 'done', 'checkout', 'pay', 'confirm', 'process', 'submit'];
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);

  // Check for completion phrases
  const isCompletionCommand = completionCommands.some(cmd => {
    return words.some(word => {
      const match = word === cmd || 
                   (word.includes(cmd) && word.length <= cmd.length + 2) ||
                   (cmd === 'complete' && word === 'completing') ||
                   (cmd === 'finish' && word === 'finishing');
      if (match) {
        console.log('Detected completion command:', {
          command: cmd,
          matchedWord: word,
          fullText: normalizedText
        });
      }
      return match;
    });
  });

  if (isCompletionCommand) {
    return {
      items: [],
      specialInstructions: 'complete_order'
    };
  }

  // Check for shutdown commands
  const shutdownCommands = ['stop', 'shutdown', 'quit', 'exit', 'end'];
  if (shutdownCommands.some(cmd => text.toLowerCase().includes(cmd))) {
    return {
      items: [],
      specialInstructions: 'shutdown_requested'
    };
  }

  // Process order commands with GPT-4
  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Using the latest model for faster processing
    messages: [
      {
        role: "system",
        content: `You are a beverage order processing assistant. Extract order details from customer voice commands.
          Return a JSON object with the following structure:
          {
            "items": [
              {
                "name": "drink name",
                "quantity": number,
                "customizations": ["customization1", "customization2"]
              }
            ],
            "specialInstructions": "any special instructions"
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
    const orderDetails = await processTranscription(text);

    if (!orderDetails) {
      throw new Error('Failed to process voice command');
    }

    return {
      success: true,
      order: orderDetails,
      isShutdown: orderDetails.specialInstructions === 'shutdown_requested'
    };
  } catch (error) {
    console.error('Error processing voice order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}