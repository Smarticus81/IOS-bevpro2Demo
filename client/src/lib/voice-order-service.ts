import OpenAI from "openai";
import { voiceCommandDebouncer, orderProcessingDebouncer, audioSynthesisDebouncer } from "./debounce";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
let openai: OpenAI | null = null;

const initializeOpenAI = () => {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not found - voice features will be limited');
      return null;
    }

    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    return null;
  }
};

// Initialize OpenAI client with proper error handling
try {
  console.log('Initializing OpenAI client...');
  openai = initializeOpenAI();
  if (openai) {
    console.log('OpenAI client initialized successfully');
  } else {
    console.warn('OpenAI client initialization skipped - running in limited mode');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  openai = null;
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

async function transcribeAudio(audioFile: Blob): Promise<string> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const formData = new FormData();
  formData.append('file', audioFile, 'voice-order.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to transcribe audio');
  }

  const data = await response.json();
  if (!data.text) {
    throw new Error('No speech detected');
  }

  return data.text;
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

  // Fallback to OpenAI for complex queries
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
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

          For demo purposes, all orders will be considered valid and processed without payment verification.
          If you detect a command to stop or shutdown, return an empty items array with specialInstructions: "shutdown_requested"`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 500
  });

  return JSON.parse(completion.choices[0].message.content);
}

export async function processVoiceOrder(audioBlob: Blob): Promise<VoiceOrderResult> {
  if (!audioBlob) {
    console.error('No audio blob provided to processVoiceOrder');
    return {
      success: false,
      error: 'No audio data received'
    };
  }

  try {
    return await voiceCommandDebouncer('voice-command', async () => {
      if (!openai) {
        console.warn('OpenAI service not initialized, voice features will be limited');
      }

      const transcribedText = await transcribeAudio(audioBlob);
      const orderDetails = await orderProcessingDebouncer('process-order', () => 
        processTranscription(transcribedText)
      );

      if (!orderDetails) {
        throw new Error('Failed to process voice command');
      }

      return {
        success: true,
        order: orderDetails,
        isShutdown: orderDetails.specialInstructions === 'shutdown_requested'
      };
    });
  } catch (error) {
    console.error('Error processing voice order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}

export async function synthesizeOrderConfirmation(order: VoiceOrderResult['order']): Promise<string> {
  if (!order || !openai) return '';

  try {
    return await audioSynthesisDebouncer('synthesize-speech', async () => {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: generateConfirmationMessage(order),
      });

      return URL.createObjectURL(new Blob([await response.arrayBuffer()]));
    });
  } catch (error) {
    console.error('Error synthesizing order confirmation:', error);
    throw error;
  }
}

function generateConfirmationMessage(order: VoiceOrderResult['order']): string {
  if (!order?.items.length) {
    return "I couldn't understand your order. Could you please repeat that?";
  }

  if (order.specialInstructions === 'shutdown_requested') {
    return "Voice ordering has been disabled. Tap the microphone icon to enable it again.";
  }

  if (order.specialInstructions === 'complete_order') {
    return "Processing your order now. Thank you for your business!";
  }

  const itemDescriptions = order.items.map(item => {
    const customizations = item.customizations?.length 
      ? ` with ${item.customizations.join(', ')}`
      : '';
    return `${item.quantity} ${item.name}${customizations}`;
  }).join(', ');

  let message = `I've got your order: ${itemDescriptions}.`;
  if (order.specialInstructions && order.specialInstructions !== 'complete_order') {
    message += ` Special instructions: ${order.specialInstructions}.`;
  }
  message += " Is this correct?";

  return message;
}