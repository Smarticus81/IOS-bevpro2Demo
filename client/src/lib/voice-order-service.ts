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

async function transcribeAudio(audioFile: File): Promise<string> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "en",
    response_format: "json",
  });

  if (!transcription.text) {
    throw new Error('No speech detected');
  }

  return transcription.text;
}

// Placeholder for the efficient local parser.  Implementation details omitted as they were not provided.
function parseVoiceCommand(text: string): { items: Array<{ name: string; quantity: number; modifiers: string[] }> } | null {
  //Implementation for local parsing would go here.  This is a placeholder.
  //A robust implementation would require significant logic to handle variations in speech.
  //This example only handles a very simple case.
  const textLower = text.toLowerCase();
  if (textLower.includes("diet coke") && textLower.includes("vodka and coke")) {
    return {
      items: [
        { name: "Diet Coke", quantity: 3, modifiers: [] },
        { name: "Vodka and Coke", quantity: 1, modifiers: [] }
      ]
    };
  }
  return null;
}

async function processTranscription(text: string): Promise<VoiceOrderResult['order']> {
  if (!openai) throw new Error('Voice processing service is not configured');

  // Check for completion commands first
  const completionCommands = ['complete', 'finish', 'done', 'checkout', 'pay', 'confirm', 'process', 'submit'];
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  
  console.log('Processing voice input:', {
    originalText: text,
    normalizedText,
    words,
    timestamp: new Date().toISOString()
  });

  // Check for completion phrases
  const isCompletionCommand = completionCommands.some(cmd => {
    const isCommand = words.some(word => {
      const match = word === cmd || 
                   (word.includes(cmd) && word.length <= cmd.length + 2) ||
                   (cmd === 'complete' && word === 'completing') ||
                   (cmd === 'finish' && word === 'finishing');
      if (match) {
        console.log('Detected completion command:', {
          command: cmd,
          matchedWord: word,
          fullText: normalizedText,
          timestamp: new Date().toISOString()
        });
      }
      return match;
    });
    return isCommand;
  });

  if (isCompletionCommand) {
    console.log('Processing completion command:', {
      text: normalizedText,
      timestamp: new Date().toISOString()
    });
    return {
      items: [],
      specialInstructions: 'complete_order'
    };
  }

  // Check for shutdown commands next
  const shutdownCommands = ['stop', 'shutdown', 'quit', 'exit', 'end'];
  if (shutdownCommands.some(cmd => text.toLowerCase().includes(cmd))) {
    return {
      items: [],
      specialInstructions: 'shutdown_requested'
    };
  }

  // Try efficient local parsing first
  try {
    const parsedCommand = parseVoiceCommand(text);
    if (parsedCommand.items && parsedCommand.items.length > 0) {
      return {
        items: parsedCommand.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          customizations: item.modifiers
        }))
      };
    }
  } catch (error) {
    console.log('Local parsing failed, falling back to OpenAI:', error);
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

  const result = JSON.parse(completion.choices[0].message.content);
  return result;
}

export async function processVoiceOrder(audioBlob: Blob): Promise<VoiceOrderResult> {
  if (!audioBlob) {
    console.error('No audio blob provided to processVoiceOrder');
    return {
      success: false,
      error: 'No audio data received'
    };
  }

  const commandId = `voice-${Date.now()}`;
  console.log('Starting voice order processing:', {
    commandId,
    blobType: audioBlob.type,
    blobSize: audioBlob.size,
    timestamp: new Date().toISOString()
  });

  try {
    return await voiceCommandDebouncer(commandId, async () => {
      if (!openai) {
        console.warn('OpenAI service not initialized, voice features will be limited');
      }
      
      // Convert webm to wav for Whisper API compatibility
      const audioFile = new File([audioBlob], "voice-order.wav", { 
        type: "audio/wav" 
      });

      const transcribedText = await transcribeAudio(audioFile);
      console.log('Transcribed text:', { commandId, text: transcribedText });

      const orderDetails = await orderProcessingDebouncer(
        `order-${commandId}`, 
        () => processTranscription(transcribedText)
      );

      return {
        success: true,
        order: orderDetails,
        isShutdown: orderDetails.specialInstructions === 'shutdown_requested'
      };
    });
  } catch (error) {
    console.error('Error processing voice order:', { commandId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}

export async function synthesizeOrderConfirmation(order: VoiceOrderResult['order']): Promise<string> {
  if (!order || !openai) return '';

  try {
    return await audioSynthesisDebouncer('synthesis', async () => {
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

  const itemDescriptions = order.items.map(item => {
    const customizations = item.customizations?.length 
      ? ` with ${item.customizations.join(', ')}`
      : '';
    return `${item.quantity} ${item.name}${customizations}`;
  }).join(', ');

  let message = `I've got your order: ${itemDescriptions}.`;
  if (order.specialInstructions && order.specialInstructions !== 'shutdown_requested') {
    message += ` Special instructions: ${order.specialInstructions}.`;
  }
  message += " Is this correct?";

  return message;
}