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

// Initialize OpenAI client
openai = initializeOpenAI();

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

  try {
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
  } catch (error) {
    console.error('Error processing transcription:', error);
    if (error instanceof Error && error.message.includes('API key')) {
      throw new Error('Voice processing service not available');
    }
    throw error;
  }
}

export async function processVoiceOrder(audioBlob: Blob): Promise<VoiceOrderResult> {
  const commandId = `voice-${Date.now()}`;

  try {
    return await voiceCommandDebouncer(commandId, async () => {
      console.log('Starting voice order processing:', { commandId });
      
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
